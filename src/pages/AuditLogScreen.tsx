import { useEffect, useState } from 'react';
import { Popup, Page, Navbar, NavRight, Link, Block, List, ListItem, Preloader, Button } from 'framework7-react';
import { fetchAuditLog, type AuditLogEntry } from '../lib/auditLog';
import { handleFirestoreError } from '../lib/sessionGuard';

interface AuditLogScreenProps {
  opened: boolean;
  onClose: () => void;
}

function formatTimestamp(entry: AuditLogEntry): string {
  if (!entry.createdAt) return 'Just now';
  return entry.createdAt.toDate().toLocaleString();
}

export default function AuditLogScreen({ opened, onClose }: AuditLogScreenProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetchAuditLog()
      .then(setEntries)
      .catch((err) => {
        handleFirestoreError(err);
        setError('Could not load the audit log.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!opened) return;
    load();
  }, [opened]);

  return (
    <Popup opened={opened} onPopupClosed={onClose} tabletFullscreen>
      <Page>
        <Navbar title="Audit Log">
          <NavRight>
            <Link popupClose>Close</Link>
          </NavRight>
        </Navbar>

        {loading ? (
          <Block className="text-align-center">
            <Preloader />
          </Block>
        ) : error ? (
          <Block className="text-align-center">
            <p style={{ color: 'var(--f7-color-red)' }}>{error}</p>
            <Button small outline round onClick={load}>
              Retry
            </Button>
          </Block>
        ) : entries.length === 0 ? (
          <Block className="text-align-center">
            <p>No admin actions logged yet.</p>
          </Block>
        ) : (
          <List strongIos outlineIos dividersIos insetIos>
            {entries.map((entry) => (
              <ListItem
                key={entry.id}
                title={entry.action}
                subtitle={entry.detail}
                text={`${entry.adminEmail} · ${formatTimestamp(entry)}`}
              />
            ))}
          </List>
        )}
      </Page>
    </Popup>
  );
}
