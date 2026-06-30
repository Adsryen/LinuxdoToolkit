/**
 * 备份与恢复
 *
 * 导出/导入所有 toolkit 配置数据，支持 JSON 文件和剪贴板。
 * 自动快照：配置变更后自动保存最近 5 份快照。
 */

import { Storage } from './storage.js'
import { logger } from './helpers.js'

const BACKUP_VERSION = 1
const MAX_SNAPSHOTS = 5
const SNAPSHOT_KEY = 'backups'
const SNAPSHOT_DATA_PREFIX = 'snapshot.'

/**
 * 导出所有 toolkit 数据为 JSON 对象
 * @returns {Promise<Object>}
 */
export async function exportAll() {
  const data = await Storage.getAll('')
  const manifest = chrome.runtime.getManifest()

  return {
    version: BACKUP_VERSION,
    appVersion: manifest?.version || '1.0.0',
    timestamp: new Date().toISOString(),
    data
  }
}

/**
 * 导出为 JSON 字符串
 * @returns {Promise<string>}
 */
export async function exportAsJSON() {
  const backup = await exportAll()
  return JSON.stringify(backup, null, 2)
}

/**
 * 导出为文件下载
 */
export async function exportToFile() {
  const json = await exportAsJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `linuxdo-toolkit-backup-${timestamp}.json`
  a.click()

  URL.revokeObjectURL(url)
  logger.info('备份文件已下载')
}

/**
 * 从 JSON 字符串解析备份数据
 * @param {string} jsonStr
 * @returns {Object|null}
 */
function parseBackup(jsonStr) {
  try {
    const backup = JSON.parse(jsonStr)

    if (!backup.version || !backup.data) {
      throw new Error('无效的备份文件：缺少 version 或 data 字段')
    }

    if (backup.version > BACKUP_VERSION) {
      throw new Error(`备份文件版本 (${backup.version}) 高于当前支持的版本 (${BACKUP_VERSION})`)
    }

    return backup
  } catch (error) {
    logger.error('解析备份失败:', error.message)
    return null
  }
}

/**
 * 获取当前数据与备份数据的差异
 * @param {Object} backupData - 备份中的 data 对象
 * @returns {Promise<Object>} { added, modified, removed, summary }
 */
export async function getDiff(backupData) {
  const currentData = await Storage.getAll('')

  const added = {}    // 备份有，当前没有
  const modified = {} // 都有，但值不同
  const removed = {}  // 当前有，备份没有

  for (const [key, value] of Object.entries(backupData)) {
    if (!(key in currentData)) {
      added[key] = value
    } else if (JSON.stringify(currentData[key]) !== JSON.stringify(value)) {
      modified[key] = { current: currentData[key], backup: value }
    }
  }

  for (const key of Object.keys(currentData)) {
    if (!(key in backupData) && key !== SNAPSHOT_KEY) {
      removed[key] = currentData[key]
    }
  }

  return {
    added,
    modified,
    removed,
    summary: {
      addedCount: Object.keys(added).length,
      modifiedCount: Object.keys(modified).length,
      removedCount: Object.keys(removed).length
    }
  }
}

/**
 * 从 JSON 字符串导入
 * @param {string} jsonStr - JSON 字符串
 * @param {'overwrite'|'merge'} strategy - 'overwrite' 完全覆盖 | 'merge' 智能合并
 * @returns {Promise<boolean>}
 */
export async function importFromJSON(jsonStr, strategy = 'overwrite') {
  const backup = parseBackup(jsonStr)
  if (!backup) return false

  try {
    // 导入前先创建快照
    await autoSnapshot()

    if (strategy === 'overwrite') {
      // 清除现有数据后写入
      await Storage.clearAll()
      await Storage.setMany(backup.data)
      logger.info('备份已覆盖导入')
    } else if (strategy === 'merge') {
      // 合并：备份数据覆盖同名 key，保留当前独有的 key
      await Storage.setMany(backup.data)
      logger.info('备份已合并导入')
    }

    return true
  } catch (error) {
    logger.error('导入备份失败:', error)
    return false
  }
}

/**
 * 从文件导入
 * @param {File} file
 * @param {'overwrite'|'merge'} strategy
 * @returns {Promise<boolean>}
 */
export async function importFromFile(file, strategy = 'overwrite') {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const success = await importFromJSON(e.target.result, strategy)
      resolve(success)
    }
    reader.onerror = () => {
      logger.error('读取文件失败')
      resolve(false)
    }
    reader.readAsText(file)
  })
}

/**
 * 导出到剪贴板（Base64 编码的压缩 JSON）
 * @returns {Promise<boolean>}
 */
export async function exportToClipboard() {
  try {
    const json = await exportAsJSON()
    // 简单 Base64 编码（中文兼容）
    const encoded = btoa(unescape(encodeURIComponent(json)))
    await navigator.clipboard.writeText(encoded)
    logger.info('备份已复制到剪贴板')
    return true
  } catch (error) {
    logger.error('复制到剪贴板失败:', error)
    return false
  }
}

/**
 * 从剪贴板导入
 * @param {'overwrite'|'merge'} strategy
 * @returns {Promise<boolean>}
 */
export async function importFromClipboard(strategy = 'overwrite') {
  try {
    const encoded = await navigator.clipboard.readText()
    const json = decodeURIComponent(escape(atob(encoded)))
    return await importFromJSON(json, strategy)
  } catch (error) {
    logger.error('从剪贴板导入失败:', error)
    return false
  }
}

/**
 * 自动保存快照
 * 配置变更后调用，最多保留 MAX_SNAPSHOTS 份
 * @returns {Promise<void>}
 */
export async function autoSnapshot() {
  try {
    // 排除快照本身和大体积的浏览记录
    const data = await Storage.getAll('')
    const snapshotData = {}
    for (const [key, value] of Object.entries(data)) {
      // 跳过快照 key 和浏览记录
      if (key === SNAPSHOT_KEY || key.startsWith(SNAPSHOT_DATA_PREFIX)) continue
      // 跳过大体积数据（如浏览历史列表）
      const jsonSize = JSON.stringify(value).length
      if (jsonSize > 50000) continue
      snapshotData[key] = value
    }

    const snapshots = (await Storage.get(SNAPSHOT_KEY)) || []

    snapshots.push({
      timestamp: Date.now(),
      version: BACKUP_VERSION,
      data: snapshotData
    })

    // 只保留最近 MAX_SNAPSHOTS 份
    while (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.shift()
    }

    await Storage.set(SNAPSHOT_KEY, snapshots)
    logger.info('快照已保存')
  } catch (error) {
    logger.error('保存快照失败:', error)
  }
}

/**
 * 列出所有快照
 * @returns {Promise<Array<{ timestamp: number, version: number }>>}
 */
export async function listSnapshots() {
  const snapshots = (await Storage.get(SNAPSHOT_KEY)) || []
  return snapshots.map((s) => ({
    timestamp: s.timestamp,
    version: s.version
  }))
}

/**
 * 恢复到指定快照
 * @param {number} timestamp - 快照时间戳
 * @returns {Promise<boolean>}
 */
export async function restoreSnapshot(timestamp) {
  const snapshots = (await Storage.get(SNAPSHOT_KEY)) || []
  const snapshot = snapshots.find((s) => s.timestamp === timestamp)

  if (!snapshot) {
    logger.error('未找到指定快照:', timestamp)
    return false
  }

  try {
    // 恢复前先保存当前状态为快照
    await autoSnapshot()

    await Storage.setMany(snapshot.data)
    logger.info('已恢复到快照:', new Date(timestamp).toLocaleString())
    return true
  } catch (error) {
    logger.error('恢复快照失败:', error)
    return false
  }
}

export const Backup = {
  exportAll,
  exportAsJSON,
  exportToFile,
  getDiff,
  importFromJSON,
  importFromFile,
  exportToClipboard,
  importFromClipboard,
  autoSnapshot,
  listSnapshots,
  restoreSnapshot
}
