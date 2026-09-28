// Backup export/import in the browser. Checking the file is done by logic.js parseBackup.
import { state, updateSettings, replaceAllData } from './state.js';
import { buildBackup, backupFileName, parseBackup, formatDateLabel, toDateStr } from './logic.js';
import { SCENES } from './kuma.js';
import { showToast } from './ui.js';

function download(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// iPhone: the share sheet ("save to Files"). Elsewhere: a normal download.
export async function exportBackup() {
  const now = new Date();
  const file = new File([JSON.stringify(buildBackup(state, now))], backupFileName(now), { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'くまべえ家計簿バックアップ' });
    else download(file);
  } catch (e) {
    if (e.name !== 'AbortError') showToast('書き出せませんでした：' + e.message);
    return false;
  }
  try {
    await updateSettings({ lastBackupAt: now.getTime(), nudgeSnoozedOn: null });
  } catch (e) {
    showToast('保存できませんでした：' + e.message);
    return false;
  }
  showToast(SCENES.backupDone.line, { image: SCENES.backupDone.image });
  return true;
}

// Replaces everything with the file's contents after a check and a confirmation.
export async function importBackup(file) {
  const result = parseBackup(await file.text());
  if (!result.ok) {
    showToast('戻せませんでした：' + result.reason);
    return false;
  }
  const when = formatDateLabel(toDateStr(new Date(result.exportedAt)));
  if (!confirm(`${when}のバックアップ、${result.entryCount}件。\n今の記録と入れ替えます。よろしいですか？`)) return false;
  try {
    await replaceAllData(result.data);
  } catch (e) {
    showToast('戻せませんでした：' + e.message);
    return false;
  }
  showToast(`${result.entryCount}件を戻しました`, { image: SCENES.backupDone.image });
  return true;
}
