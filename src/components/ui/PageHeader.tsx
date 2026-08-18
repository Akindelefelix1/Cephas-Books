import { Download, Plus } from 'lucide-react';
import { confirmAction, downloadText } from '@/utils/actions';

interface PageHeaderProps {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}

export function PageHeader({ title, description, action, onAction }: PageHeaderProps) {
  const exportPage = () => {
    const content = `${title}\n${description}\nExported ${new Date().toLocaleString()}`;
    downloadText(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-export.txt`, content);
  };
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-header__actions">
        <button className="button button--secondary" onClick={exportPage}>
          <Download size={17} /> Export
        </button>
        {action && (
          <button
            className="button"
            onClick={onAction ?? (() => confirmAction(`${action} form opened`))}
          >
            <Plus size={17} />
            {action}
          </button>
        )}
      </div>
    </div>
  );
}
