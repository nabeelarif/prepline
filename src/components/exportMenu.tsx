import { FileDown, FileJson, FileText } from 'lucide-react';
import { exportFileName, planToHtml, planToJson, planToMarkdown } from '../domain/exportPlan';
import type { PlanSharing } from '../domain/share';
import type { Goal } from '../domain/types';
import { downloadText, printHtml } from './downloadFile';
import type { MenuEntry } from './Menu';

/** Menu entries that export one plan as JSON, Markdown or PDF. */
export function exportMenuItems(goal: Goal, sharing: PlanSharing | undefined): MenuEntry[] {
  return [
    { heading: 'Export plan' },
    {
      label: 'JSON (re-importable)',
      icon: <FileJson size={16} />,
      onSelect: () =>
        downloadText(
          exportFileName(goal, 'json'),
          'application/json',
          planToJson(goal, sharing, new Date()),
        ),
    },
    {
      label: 'Markdown',
      icon: <FileText size={16} />,
      onSelect: () =>
        downloadText(exportFileName(goal, 'md'), 'text/markdown', planToMarkdown(goal)),
    },
    {
      label: 'PDF (print)',
      icon: <FileDown size={16} />,
      onSelect: () => printHtml(planToHtml(goal)),
    },
  ];
}
