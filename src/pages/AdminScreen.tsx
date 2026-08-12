import { useEffect, useState } from 'react';
import { Page, Navbar, NavRight, Link, Icon, Block, BlockTitle, Button, Preloader, f7 } from 'framework7-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  listAccounts,
  resetStoreCode,
  changeAccountEmailOnFile,
  fetchDailyTotalsForAccount,
  deleteAccount,
  type AdminAccount,
  type DailyUsagePoint,
} from '../lib/admin';
import { logAdminAction } from '../lib/auditLog';
import { RESERVED_ADMIN_CODE } from '../lib/adminSession';
import { handleFirestoreError } from '../lib/sessionGuard';
import UsageChart from '../components/UsageChart';
import AuditLogScreen from './AuditLogScreen';

interface AdminScreenProps {
  onViewAccount: (uid: string) => void;
}

const CODE_PATTERN = /^\d{5}$/;
const USAGE_WINDOW_DAYS = 30;

export default function AdminScreen({ onViewAccount }: AdminScreenProps) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [usageByUid, setUsageByUid] = useState<Record<string, DailyUsagePoint[]>>({});
  const [usageLoadingUid, setUsageLoadingUid] = useState<string | null>(null);
  const [usageErrorUid, setUsageErrorUid] = useState<string | null>(null);
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    listAccounts()
      .then(setAccounts)
      .catch((err) => {
        handleFirestoreError(err);
        setError('Could not load accounts.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Fetched lazily per store, only once its chart is first opened - not for
  // the whole list up front, since a 30-day window can touch a lot of
  // tally documents per store.
  const loadUsage = (account: AdminAccount) => {
    setUsageErrorUid(null);
    setUsageLoadingUid(account.uid);
    fetchDailyTotalsForAccount(account.uid, USAGE_WINDOW_DAYS)
      .then((points) => setUsageByUid((prev) => ({ ...prev, [account.uid]: points })))
      .catch(() => setUsageErrorUid(account.uid))
      .finally(() => setUsageLoadingUid(null));
  };

  const toggleUsage = (account: AdminAccount) => {
    if (expandedUid === account.uid) {
      setExpandedUid(null);
      return;
    }
    setExpandedUid(account.uid);
    if (!usageByUid[account.uid]) loadUsage(account);
  };

  const handleResetCode = (account: AdminAccount) => {
    f7.dialog.prompt('New 5-digit store code', `Reset Code (${account.contactEmail})`, async (value) => {
      const newCode = value.replace(/\D/g, '').slice(0, 5);
      if (!CODE_PATTERN.test(newCode)) {
        f7.dialog.alert('Must be exactly 5 digits.', 'Invalid Code');
        return;
      }
      if (newCode === RESERVED_ADMIN_CODE) {
        f7.dialog.alert('That code is reserved.', 'Invalid Code');
        return;
      }
      setBusyCode(account.code);
      try {
        await resetStoreCode(account.code, newCode);
        load();
      } catch (err) {
        f7.dialog.alert(err instanceof Error ? err.message : 'Could not reset code.', 'Error');
      } finally {
        setBusyCode(null);
      }
    });
  };

  const handleDeleteAccount = (account: AdminAccount) => {
    f7.dialog.confirm(
      `Permanently delete store ${account.code} (${account.contactEmail})? This erases all of its categories, items, and tally history and cannot be undone.`,
      'Delete Store',
      async () => {
        setBusyCode(account.code);
        try {
          await deleteAccount(account.code, account.uid);
          if (expandedUid === account.uid) setExpandedUid(null);
          load();
        } catch {
          f7.dialog.alert('Could not delete this store.', 'Error');
        } finally {
          setBusyCode(null);
        }
      },
    );
  };

  const handleChangeEmail = (account: AdminAccount) => {
    f7.dialog.prompt(
      "New contact email (for reference only - doesn't affect this store's login)",
      `Change Email (${account.code})`,
      async (value) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        setBusyCode(account.code);
        try {
          await changeAccountEmailOnFile(account.code, trimmed);
          load();
        } catch {
          f7.dialog.alert('Could not update email.', 'Error');
        } finally {
          setBusyCode(null);
        }
      },
    );
  };

  return (
    <Page>
      <Navbar title="Admin">
        <NavRight>
          <Link onClick={() => setAuditLogOpen(true)}>
            <Icon f7="doc_text" />
          </Link>
          <Link className="text-color-red sign-out-link" onClick={() => signOut(auth)}>
            Sign Out
          </Link>
        </NavRight>
      </Navbar>

      <div className="admin-content">
        <BlockTitle>Stores{accounts.length > 0 ? ` (${accounts.length})` : ''}</BlockTitle>

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
        ) : accounts.length === 0 ? (
          <Block className="text-align-center">
            <p>No accounts yet.</p>
          </Block>
        ) : (
          <Block>
            {accounts.map((account) => (
              <div key={account.code}>
                <div className="admin-account-row">
                  <div className="admin-account-info">
                    <div className="admin-account-code">{account.code}</div>
                    <div className="admin-account-email">{account.contactEmail}</div>
                  </div>
                  <div className="admin-account-actions">
                    <Button
                      small
                      outline
                      round
                      className={expandedUid === account.uid ? 'usage-toggle-active' : undefined}
                      onClick={() => toggleUsage(account)}
                    >
                      Usage
                    </Button>
                    <Button small outline round disabled={busyCode === account.code} onClick={() => handleResetCode(account)}>
                      Reset Code
                    </Button>
                    <Button small outline round disabled={busyCode === account.code} onClick={() => handleChangeEmail(account)}>
                      Edit Email
                    </Button>
                    <Button
                      small
                      fill
                      round
                      disabled={busyCode === account.code}
                      onClick={() => {
                        logAdminAction('View Store', `Viewed store ${account.code}`, account.code);
                        onViewAccount(account.uid);
                      }}
                    >
                      {busyCode === account.code ? <Preloader color="white" /> : 'View'}
                    </Button>
                    <Button
                      small
                      outline
                      round
                      color="red"
                      disabled={busyCode === account.code}
                      onClick={() => handleDeleteAccount(account)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {expandedUid === account.uid &&
                  (usageLoadingUid === account.uid ? (
                    <div className="usage-chart-loading">
                      <Preloader />
                    </div>
                  ) : usageErrorUid === account.uid ? (
                    <div className="usage-chart-error">
                      Could not load usage. <a onClick={() => loadUsage(account)}>Retry</a>
                    </div>
                  ) : usageByUid[account.uid] ? (
                    <UsageChart data={usageByUid[account.uid]} />
                  ) : null)}
              </div>
            ))}
          </Block>
        )}
      </div>

      <AuditLogScreen opened={auditLogOpen} onClose={() => setAuditLogOpen(false)} />
    </Page>
  );
}
