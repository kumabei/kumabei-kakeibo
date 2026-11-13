// The words and pictures of each review card (Ver.1.4.0 spec 4). Pure: no DOM. js/review.js gives the numbers;
// js/screens/review.js draws what cardContent returns.
import { formatYen, formatNumber, formatDateLabel } from './logic.js';
import { LINES } from './lines.js';
import { CATEGORY_IMAGES } from './kuma.js';

// k = Kumabee stamps, y = family stamps (img/kuma/). top3 uses the first category's picture when it has one.
export const REVIEW_IMAGES = {
  cover: 'y19', count: 'k09', top3: 'k15', biggest: 'k12', zeroDays: 'k02', compare: 'k08',
  savings: 'y15', savingsMinus: 'k06', feature: 'k14', closing: 'k01',
};

const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const monthDay = dateStr => `${Number(dateStr.slice(5, 7))}月${Number(dateStr.slice(8))}日`;
const monthLabel = ym => `${Number(ym.slice(5))}月`;

const FEATURES = {
  saver: () => LINES.featureSaver,
  thrifty: () => LINES.featureThrifty,
  category: card => fill(LINES.featureCategory, { name: card.name }),
};

// { image, title, big (or null), rows (top3 only, or null), details: [string], line }
export function cardContent(card) {
  const c = { image: REVIEW_IMAGES[card.kind], big: null, rows: null, details: [] };
  switch (card.kind) {
    case 'cover':
      return { ...c, title: `${card.year}年のふりかえり`, details: [`${monthDay(card.start)}〜${monthDay(card.end)}の記録から`], line: LINES.reviewCover };
    case 'count':
      return { ...c, title: '記録した件数', big: `${formatNumber(card.entries)}件`, details: [`記録した日は${card.days}日`], line: LINES.reviewCount };
    case 'top3':
      return {
        ...c,
        image: CATEGORY_IMAGES[card.rows[0].categoryId]?.[0] ?? REVIEW_IMAGES.top3,
        title: 'よく使った分類',
        rows: card.rows.map((r, i) => ({ rank: i + 1, name: r.name, count: r.count })),
        line: fill(LINES.reviewTop, { name: card.rows[0].name }),
      };
    case 'biggest':
      return {
        ...c, title: '一番高い買い物', big: formatYen(card.amount),
        details: [`${formatDateLabel(card.date)} ${card.name}`, card.memo].filter(Boolean), line: LINES.reviewBiggest,
      };
    case 'zeroDays':
      return {
        ...c, title: '1円も使わなかった日', big: `${card.zero}日`, details: [`${card.days}日のうち`],
        line: card.zero > 0 ? LINES.reviewZero : LINES.reviewZeroNone,
      };
    case 'compare': {
      const months = `${monthLabel(card.a)}と${monthLabel(card.b)}`;
      const extra = card.most ? [
        `一番使った月　${monthLabel(card.most.ym)} ${formatYen(card.most.amount)}`,
        `一番少なかった月　${monthLabel(card.least.ym)} ${formatYen(card.least.amount)}`,
      ] : [];
      if (!card.change) return { ...c, title: '月をくらべると', big: 'ほとんど同じ', details: [months, ...extra], line: LINES.reviewCompareSame };
      const down = card.change.diff < 0;
      return {
        ...c, title: '月をくらべると', big: `${formatYen(Math.abs(card.change.diff))}${down ? 'へった' : 'ふえた'}`,
        details: [`${months}の${card.change.name}`, ...extra], line: down ? LINES.reviewCompareDown : LINES.reviewCompareUp,
      };
    }
    case 'savings':
      return card.rate >= 0
        ? { ...c, title: '貯蓄率', big: `${card.rate}%`, details: ['収入のうち、これだけ残せたよ'], line: LINES.reviewSaving }
        : { ...c, image: REVIEW_IMAGES.savingsMinus, title: '貯蓄率', big: formatYen(-card.diff), details: ['収入より多く使ったよ'], line: LINES.reviewSavingMinus };
    case 'feature': {
      const feature = FEATURES[card.feature](card);
      return { ...c, title: '今年の特徴', big: feature, line: fill(LINES.reviewFeature, { feature }) };
    }
    case 'closing':
      return { ...c, title: '1年ありがとう', line: LINES.reviewClosing };
    default:
      throw new Error(`unknown card: ${card.kind}`);
  }
}
