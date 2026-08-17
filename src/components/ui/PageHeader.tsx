import { Download, Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}

export function PageHeader({ title, description, action, onAction }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-header__actions">
        <button className="button button--secondary">
          <Download size={17} /> Export
        </button>
        {action && (
          <button className="button" onClick={onAction}>
            <Plus size={17} />
            {action}
          </button>
        )}
      </div>
    </div>
  );
}
