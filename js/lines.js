// Every line Kumabee says, kept in one file so they are easy to change later.
export const LINES = {
  welcome: 'おかえり～',
  peek: 'なに買ったの？',
  recorded: '記録できたね！えらい！',
  big: '……ちょっと使ったね？',
  income: 'やったね♪',
  deleted: 'けしたよ',
  empty: 'まだ記録ないよ',
  monthEnd: '今月もおつかれさん！',
  home: '今月もいっしょにがんばろ',
  backupNudge: 'そろそろバックアップしとこ？',
  backupDone: 'ありがとう！安心だね',
  belowZero: '金額が0円以下になってるよ',
  // Ver.1.3.0 (big input). {amount} is filled in by screens/input.js.
  kept: '{amount}円はとっておいたよ',
  missingAmount: '金額を入れてね',
  edited: '直しました',
  // Fixed costs. {…} marks are filled in by js/fixed.js.
  autoRecorded: '{names}、自動で記録しておいたよ～！',
  autoRecordedMany: '{name}など{count}件、自動で記録しておいたよ～！',
  thisMonth: '今月の',
  nameJoin: 'と',
  askStarted: '今月分（{date}）はもう入れた？',
  askFixedNew: 'これ、毎月の固定費（{name}）にあるけど？',
  askFixedRecorded: '{month}の{name}はもう記録してあるよ。それでも入れる？',
  askFixedDeleted: '{month}の{name}は消してあるよ。固定費の分として入れ直す？',
};
