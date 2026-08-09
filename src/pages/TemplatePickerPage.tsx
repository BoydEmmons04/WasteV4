import { useEffect, useState } from 'react';
import { Page, Navbar, Block, BlockTitle, Button, Preloader } from 'framework7-react';
import { fetchPublishedTemplates, copyTemplateIntoAccount, type PublishedTemplateMeta } from '../lib/templates';

interface TemplatePickerPageProps {
  onDone: () => void;
}

export default function TemplatePickerPage({ onDone }: TemplatePickerPageProps) {
  const [templates, setTemplates] = useState<PublishedTemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyingUid, setCopyingUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPublishedTemplates()
      .then(setTemplates)
      .catch(() => setError('Could not load templates.'))
      .finally(() => setLoading(false));
  }, []);

  const handleUseTemplate = async (uid: string) => {
    setCopyingUid(uid);
    setError('');
    try {
      await copyTemplateIntoAccount(uid);
      onDone();
    } catch {
      setError('Could not copy that template. Try again or start from scratch.');
    } finally {
      setCopyingUid(null);
    }
  };

  return (
    <Page>
      <Navbar title="Start Your Store" />
      <BlockTitle large className="text-align-center margin-top-large">
        Welcome to CFA Waste
      </BlockTitle>
      <Block className="text-align-center">
        <p>Copy items and categories from another store to get started faster, or start with a blank slate.</p>
      </Block>

      {loading ? (
        <Block className="text-align-center">
          <Preloader />
        </Block>
      ) : templates.length === 0 ? (
        <Block className="text-align-center">
          <p>No published templates yet.</p>
        </Block>
      ) : (
        <Block>
          {templates.map((t) => (
            <div key={t.uid} className="template-card">
              <div>
                <div className="template-card-label">{t.label}</div>
                <div className="template-card-meta">
                  {t.categoryCount} categories · {t.itemCount} items
                </div>
              </div>
              <Button small fill round disabled={copyingUid !== null} onClick={() => handleUseTemplate(t.uid)}>
                {copyingUid === t.uid ? <Preloader color="white" /> : 'Use'}
              </Button>
            </div>
          ))}
        </Block>
      )}

      {error && (
        <Block className="text-align-center" style={{ color: 'var(--f7-color-red)' }}>
          {error}
        </Block>
      )}

      <Block>
        <Button large outline round disabled={copyingUid !== null} onClick={onDone}>
          Start from Scratch
        </Button>
      </Block>
    </Page>
  );
}
