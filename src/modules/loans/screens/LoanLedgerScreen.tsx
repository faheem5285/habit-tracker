import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text } from '../../../components/Themed';
import { useSettings } from '../../../context/SettingsContext';
import { cancelHabitNotifications, scheduleLoanNotifications, schedulePurchaseNotification } from '../../../utils/notifications';
import { uploadImage } from '../../../../cloudinaryUpload';
import { syncRecoveryModule } from '../../../utils/recovery';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCREEN_PADDING, SPACING } from '../../../ui';
import { toLocalISODate, toLocalISOMonth } from '../../../utils/dates';
import AppSheet from '../../../components/AppSheet';
import HorizontalChips from '../../../components/HorizontalChips';
import ScreenHeader from '../../../components/ScreenHeader';
import { ScreenLoader } from '../../../components/ScreenLoader';
import EmptyState from '../../../components/EmptyState';
import SegmentedControl from '../../../components/SegmentedControl';
import { formatMoney } from '../../../utils/currency';
import { appCopy } from '../../../copy';
import Button from '../../../components/Button';
import Chip from '../../../components/Chip';
import TextField from '../../../components/TextField';
import Card from '../../../components/Card';
import { loadLedger, saveLedger } from '../storage';
import { EMPTY_LEDGER, Loan, LoanLedgerData, LoanPayment, LoanPerson, PurchaseReminder, isDueWithinNextSevenDays, loanStatus, newId, paymentTotal, remainingAmount } from '../types';

type FormKind = 'person' | 'loan' | 'payment' | 'editPayment' | 'purchase' | null;
type LoanFilter = 'all' | 'active' | 'settled' | 'overdue' | 'lent' | 'borrowed';
type OverviewRow =
  | { type: 'person'; id: string; person: LoanPerson }
  | { type: 'loan'; id: string; loan: Loan };
const today = () => toLocalISODate(new Date());
const formatLoanDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'not set';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const formatPurchaseMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};
const formatShortDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'not set';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function LoanLedgerScreen() {
  const { colors, isDark } = useSettings();
  const [data, setData] = useState<LoanLedgerData>(EMPTY_LEDGER);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [listMode, setListMode] = useState<'people' | 'loans'>('people');
  const [loanFilter, setLoanFilter] = useState<LoanFilter>('all');
  const [personId, setPersonId] = useState<string | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [showPurchases, setShowPurchases] = useState(false);
  const [form, setForm] = useState<FormKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<'gave' | 'took'>('gave');
  const [reminder, setReminder] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const [datePicker, setDatePicker] = useState<{ field: 'date' | 'dueDate' | 'targetMonth' | 'reminderDate'; value: Date } | null>(null);
  const retryLoad = async () => {
    setLoaded(false);
    setLoadError(null);
    try {
      setData(await loadLedger());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load saved loan data.');
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => {
    let active = true;
    void loadLedger()
      .then((storedData) => { if (active) setData(storedData); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load saved loan data.'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded || loadError) return;
    void saveLedger(data)
      .then(() => syncRecoveryModule('loans').catch((error) => console.warn('Loan backup sync failed:', error)))
      .catch((error) => Alert.alert('Could not save loan data', error instanceof Error ? error.message : 'Please try again.'));
  }, [data, loaded, loadError]);
  const person = data.people.find((p) => p.id === personId);
  const loan = data.loans.find((l) => l.id === loanId);
  const phoneDigits = person?.phone.replace(/\D/g, '') ?? '';
  const hasPhone = !!person?.phone.trim();
  const canContact = /^\d{7,15}$/.test(phoneDigits);
  const openContact = async (url: string, label: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(`Could not open ${label}`, error instanceof Error ? error.message : 'Please try again.');
    }
  };
  const openForm = (kind: Exclude<FormKind, null>, values: Record<string, string> = {}, id: string | null = null) => { setEditingId(id); setFields(values); setForm(kind); };
  const updateField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));
  const dateField = (field: 'date' | 'dueDate' | 'targetMonth' | 'reminderDate', label: string) => {
    const raw = fields[field] || '';
    const parsed = new Date(`${field === 'targetMonth' ? `${raw}-01` : raw}T12:00:00`);
    const value = Number.isFinite(parsed.getTime()) ? parsed : new Date();
    return <View style={styles.field} key={field}><Text style={styles.fieldLabel}>{label}</Text><Pressable onPress={() => setDatePicker({ field, value })} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}><Text style={{ color: raw ? colors.text : colors.muted }}>{raw || label}</Text><Ionicons name="calendar-outline" size={18} color={colors.primary} /></Pressable></View>;
  };
  const onDatePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!datePicker || event.type !== 'set' || !selected) {
      setDatePicker(null);
      return;
    }
    const { field } = datePicker;
    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, '0');
    const day = String(selected.getDate()).padStart(2, '0');
    updateField(field, field === 'targetMonth' ? `${year}-${month}` : `${year}-${month}-${day}`);
    setDatePicker(null);
  };
  const replaceLoan = (next: Loan) => setData((prev) => ({ ...prev, loans: prev.loans.map((item) => item.id === next.id ? next : item) }));
  const choosePhoto = async (target: 'person' | 'loan') => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      setBusy(true);
      const uploaded = await uploadImage(result.assets[0]);
      updateField(target === 'person' ? 'photoUrl' : 'attachmentUrl', uploaded.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/ExponentImagePicker|undefined is not a function/i.test(message)) {
        Alert.alert('App update needed', 'Photo picking is missing from this installed app build. Rebuild and reinstall the Android app to add the native photo picker.');
      } else {
        Alert.alert('Photo upload failed', message || 'Try again.');
      }
    }
    finally { setBusy(false); }
  };
  const saveForm = async () => {
    if (!form || busy || saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    try {
      const now = today();
      if (form === 'person') {
        if (!fields.name?.trim()) return Alert.alert('Name required', 'Enter a name for this person.');
        const value: LoanPerson = { id: editingId || newId(), name: fields.name.trim(), phone: fields.phone || '', photoUrl: fields.photoUrl || '', notes: fields.notes || '', createdAt: editingId ? data.people.find((p) => p.id === editingId)?.createdAt || now : now };
        setData((prev) => ({ ...prev, people: editingId ? prev.people.map((p) => p.id === value.id ? value : p) : [...prev.people, value] }));
        setPersonId(value.id);
      } else if (form === 'purchase') {
        const targetMonth = fields.targetMonth || '';
        if (!fields.title?.trim() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) return Alert.alert('Check purchase details', 'Add an item name and month in YYYY-MM format.');
        const existing = editingId ? data.purchaseReminders.find((item) => item.id === editingId) : undefined;
        if (existing) await cancelHabitNotifications(existing.notificationIds);
        const value: PurchaseReminder = { id: existing?.id || newId(), title: fields.title.trim(), targetMonth, reminderDate: fields.reminderDate || `${targetMonth}-01`, note: fields.note || '', notificationIds: [] };
        value.notificationIds = await schedulePurchaseNotification(value.title, value.reminderDate, value.id);
        setData((prev) => ({ ...prev, purchaseReminders: existing ? prev.purchaseReminders.map((item) => item.id === value.id ? value : item) : [...prev.purchaseReminders, value] }));
        setShowPurchases(true);
      } else if (form === 'loan') {
        const amount = Number(fields.amount);
        if (!Number.isFinite(amount) || amount <= 0 || !personId) return Alert.alert('Check loan details', 'Enter an amount greater than zero.');
        const existing = editingId ? data.loans.find((item) => item.id === editingId) : undefined;
        if (existing) await cancelHabitNotifications(existing.reminderIds);
        const value: Loan = { id: existing?.id || newId(), personId, direction, amount, date: fields.date || now, dueDate: fields.dueDate || now, note: fields.note || '', attachmentUrl: fields.attachmentUrl || '', reminderIds: [], reminderEnabled: reminder, payments: existing?.payments || [] };
        if (reminder && loanStatus(value) !== 'paid') value.reminderIds = await scheduleLoanNotifications(`${person?.name || 'Loan'} · ${formatMoney(amount)}`, value.dueDate, value.id);
        setData((prev) => ({ ...prev, loans: existing ? prev.loans.map((item) => item.id === value.id ? value : item) : [...prev.loans, value] }));
        setLoanId(value.id);
      } else if (form === 'payment' || form === 'editPayment') {
        if (!loan) return;
        const amount = Number(fields.amount);
        const old = form === 'editPayment' ? loan.payments.find((p) => p.id === editingId) : undefined;
        const available = remainingAmount(loan) + (old?.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0 || amount > available) return Alert.alert('Invalid payment', `Enter an amount up to ${formatMoney(available)}.`);
        const payment: LoanPayment = { id: old?.id || newId(), amount, date: fields.date || now, note: fields.note || '' };
        const payments = old ? loan.payments.map((p) => p.id === old.id ? payment : p) : [...loan.payments, payment];
        const next = { ...loan, payments };
        if (remainingAmount(next) <= 0) { await cancelHabitNotifications(next.reminderIds); next.reminderIds = []; }
        else if (next.reminderEnabled && next.reminderIds.length === 0) next.reminderIds = await scheduleLoanNotifications(`${person?.name || 'Loan'} · ${formatMoney(next.amount)}`, next.dueDate, next.id);
        replaceLoan(next);
      }
      setForm(null);
    } catch (error) {
      Alert.alert('Could not save changes', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };
  const deletePerson = () => person && Alert.alert('Delete person?', `This also deletes ${person.name}'s loans and payment history.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void Promise.all(data.loans.filter((l) => l.personId === person.id).map((l) => cancelHabitNotifications(l.reminderIds))); setData((prev) => ({ ...prev, people: prev.people.filter((p) => p.id !== person.id), loans: prev.loans.filter((l) => l.personId !== person.id) })); setPersonId(null); setLoanId(null); setForm(null); setEditingId(null); } }]);
  const deleteLoan = () => loan && Alert.alert('Delete loan?', 'This removes the loan and its payment history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void cancelHabitNotifications(loan.reminderIds); setData((prev) => ({ ...prev, loans: prev.loans.filter((l) => l.id !== loan.id) })); setLoanId(null); } }]);
  const deletePayment = (paymentId: string) => loan && Alert.alert('Delete payment?', 'The remaining balance will be recalculated.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => replaceLoan({ ...loan, payments: loan.payments.filter((p) => p.id !== paymentId) }) }]);
  const deletePurchase = (purchase: PurchaseReminder) => Alert.alert('Delete reminder?', `Remove the reminder for ${purchase.title}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void cancelHabitNotifications(purchase.notificationIds); setData((prev) => ({ ...prev, purchaseReminders: prev.purchaseReminders.filter((item) => item.id !== purchase.id) })); } }]);
  const totals = useMemo(() => {
    let receive = 0; let pay = 0; let overdue = 0; let weekAmount = 0; let weekCount = 0; let overdueCount = 0;
    const todayDate = new Date();
    for (const item of data.loans) {
      const remaining = remainingAmount(item);
      const status = loanStatus(item);
      if (item.direction === 'gave') receive += remaining; else pay += remaining;
      if (status === 'overdue') { overdue += remaining; overdueCount += 1; }
      if (isDueWithinNextSevenDays(item, todayDate)) { weekCount += 1; weekAmount += remaining; }
    }
    return { receive, pay, overdue, weekAmount, weekCount, overdueCount };
  }, [data.loans]);
  const personBalance = (id: string) => data.loans.filter((l) => l.personId === id).reduce((sum, l) => sum + (l.direction === 'gave' ? remainingAmount(l) : -remainingAmount(l)), 0);
  const normalizedQuery = query.trim().toLowerCase();
  const shownPeople = data.people.filter((p) => `${p.name} ${p.phone}`.toLowerCase().includes(normalizedQuery));
  const shownLoans = data.loans
    .filter((item) => {
      const status = loanStatus(item);
      const personName = data.people.find((itemPerson) => itemPerson.id === item.personId)?.name ?? '';
      const matchesSearch = `${personName} ${item.note} ${item.date} ${item.dueDate}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter = loanFilter === 'all' ||
        (loanFilter === 'active' && status !== 'paid') ||
        (loanFilter === 'settled' && status === 'paid') ||
        (loanFilter === 'overdue' && status === 'overdue') ||
        (loanFilter === 'lent' && item.direction === 'gave') ||
        (loanFilter === 'borrowed' && item.direction === 'took');
      return matchesSearch && matchesFilter;
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id));
  const overviewRows: OverviewRow[] = listMode === 'loans'
    ? shownLoans.map((loan) => ({ type: 'loan', id: loan.id, loan }))
    : shownPeople.map((person) => ({ type: 'person', id: person.id, person }));
  const actionButton = (label: string, onPress: () => void, danger = false, disabled = false) => <Button label={label} onPress={onPress} variant={danger ? 'destructive' : 'tonal'} size="compact" disabled={disabled} />;
  const deleteActionButton = (onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={onPress} style={[styles.iconAction, { backgroundColor: colors.dangerSoft }]}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>;
  const fieldInput = (key: string, label: string, options: { keyboardType?: 'default' | 'decimal-pad' | 'phone-pad'; multiline?: boolean; placeholder?: string } = {}) => <TextField key={key} label={label} containerStyle={styles.field} value={fields[key] || ''} onChangeText={(v) => updateField(key, v)} placeholder={options.placeholder || label} keyboardType={options.keyboardType} multiline={options.multiline} />;
  const statusColor = (status: string) => status === 'paid'
    ? isDark ? '#4ADE80' : '#15803D'
    : status === 'overdue'
      ? isDark ? '#F87171' : '#B91C1C'
      : isDark ? '#FBBF24' : '#B45309';
  const filters: { value: LoanFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'settled', label: 'Settled' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'lent', label: 'Lent' },
    { value: 'borrowed', label: 'Borrowed' },
  ];
  const overviewHeader = (
    <View>
      <ScreenHeader title="Loans" subtitle="Know what is owed and what is due." style={styles.pageHeading} />
      {totals.overdue > 0 && (
        <Card onPress={() => { setListMode('loans'); setLoanFilter('overdue'); }} style={[styles.overdueBanner, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.overdueTitle, { color: colors.danger }]}>{appCopy.loans.overdueBalance}</Text>
            <Text style={{ color: colors.textSecondary }}>{formatMoney(totals.overdue)} {appCopy.loans.overdueNeedsAttention}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.danger} />
        </Card>
      )}
      <View style={styles.summaryGrid}>
        {[
          ['To receive', totals.receive],
          ['To pay', totals.pay],
          ['Overdue', totals.overdue],
          ['Due this week', totals.weekCount],
        ].map(([label, value]) => (
          <Card key={String(label)} style={styles.summaryCard}>
            <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.summaryAmount, { color: label === 'Overdue' && Number(value) > 0 ? colors.danger : colors.primary }]}>
              {label === 'Due this week' ? value : formatMoney(Number(value))}
            </Text>
            {label === 'Overdue' && (
              <Text style={[styles.summaryCaption, { color: totals.overdueCount > 0 ? colors.danger : colors.textSecondary }]}>
                {totals.overdueCount} overdue {totals.overdueCount === 1 ? 'loan' : 'loans'}
              </Text>
            )}
            {label === 'Due this week' && (
              <Text style={[styles.summaryCaption, { color: colors.textSecondary }]}>
                {formatMoney(totals.weekAmount)} total
              </Text>
            )}
          </Card>
        ))}
      </View>
      <Card style={styles.netCard}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>NET BALANCE</Text>
          <Text style={[styles.netCaption, { color: colors.textSecondary }]}>
            {totals.receive > totals.pay ? 'More is owed to you' : totals.receive < totals.pay ? 'You owe more' : 'Your balances are even'}
          </Text>
        </View>
        <Text style={[styles.netAmount, { color: totals.receive === totals.pay ? colors.primary : totals.receive > totals.pay ? colors.success : colors.danger }]}>
          {totals.receive > totals.pay ? '+' : totals.receive < totals.pay ? '−' : ''}{formatMoney(Math.abs(totals.receive - totals.pay))}
        </Text>
      </Card>
      <Card onPress={() => setShowPurchases(true)} accessibilityLabel="Planned purchases" style={styles.plannedPurchasesRow}>
        <View style={[styles.plannedIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="cart-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.personName}>Planned purchases</Text>
          <Text style={[styles.plannedHint, { color: colors.textSecondary }]}>Plan ahead and set a reminder.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </Card>
      <View style={styles.listModeRow}>
        <SegmentedControl
          colors={colors}
          value={listMode}
          onChange={setListMode}
          style={styles.listModeControl}
          options={[
            { value: 'people', label: 'People' },
            { value: 'loans', label: 'Loans' },
          ]}
        />
        {listMode === 'people' ? actionButton('+ Add person', () => openForm('person', { name: '', phone: '', notes: '', photoUrl: '' })) : null}
      </View>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={listMode === 'loans' ? 'Search person, note, or date' : 'Search people'}
        accessibilityLabel="Search loans and people"
        style={[styles.search, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      {listMode === 'loans' ? (
        <HorizontalChips>
          {filters.map((filter) => (
            <Chip key={filter.value} label={filter.label} selected={loanFilter === filter.value} onPress={() => setLoanFilter(filter.value)} />
          ))}
        </HorizontalChips>
      ) : null}
    </View>
  );
  const renderOverviewRow = ({ item }: { item: OverviewRow }) => {
    if (item.type === 'person') {
      const balance = personBalance(item.person.id);
      return (
        <Card onPress={() => setPersonId(item.person.id)} style={styles.listCard}>
          {item.person.photoUrl ? <Image source={{ uri: item.person.photoUrl }} style={styles.smallAvatar} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{item.person.name}</Text>
            <Text style={{ color: colors.textSecondary }}>{item.person.phone || 'Tap to view loans'}</Text>
          </View>
          <Text style={{ color: balance >= 0 ? colors.success : colors.danger, fontWeight: '800' }}>
            {balance >= 0 ? '+' : '−'}{formatMoney(Math.abs(balance))}
          </Text>
        </Card>
      );
    }

    const personName = data.people.find((candidate) => candidate.id === item.loan.personId)?.name || 'Person';
    return (
      <Card onPress={() => { setPersonId(item.loan.personId); setLoanId(item.loan.id); }} style={styles.listCard}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.personName} numberOfLines={1}>{personName} · {item.loan.direction === 'gave' ? 'Lent' : 'Borrowed'}</Text>
          <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
            {item.loan.note || 'Loan'} · Due {formatLoanDate(item.loan.dueDate)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.personName}>{formatMoney(remainingAmount(item.loan))}</Text>
          <Text style={{ color: statusColor(loanStatus(item.loan)), fontWeight: '800', fontSize: 12 }}>
            {loanStatus(item.loan).toUpperCase()}
          </Text>
        </View>
      </Card>
    );
  };

  if (!loaded) {
    return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}><ScreenLoader label="Loading your loan records" /></SafeAreaView>;
  }
  if (loadError) {
    return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Loans" subtitle="Know what is owed and what is due." />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SCREEN_PADDING, gap: 12 }}>
        <Text style={{ color: colors.danger, textAlign: 'center' }}>{loadError}</Text>
        <Button label="Try again" variant="tonal" size="compact" onPress={retryLoad} />
      </View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    {loan ? <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title="Loan details" style={styles.pageHeading} />
      <Pressable accessibilityRole="button" onPress={() => setLoanId(null)} style={styles.back}><Ionicons name="chevron-back" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>{person?.name || 'Person'}</Text></Pressable>
      <Card style={styles.hero}><Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{loan.direction === 'gave' ? 'YOU LENT' : 'YOU BORROWED'}</Text><Text style={styles.bigAmount}>{formatMoney(loan.amount)}</Text><Text style={{ color: colors.textSecondary }}>Paid {formatMoney(paymentTotal(loan))} · Remaining {formatMoney(remainingAmount(loan))}</Text><Text style={[styles.status, { color: statusColor(loanStatus(loan))}]}>{loanStatus(loan).toUpperCase()} · Due {formatLoanDate(loan.dueDate)}</Text></Card>
      <View style={styles.loanDetailActions}>
        <Button label="Add payment" onPress={() => openForm('payment', { amount: String(remainingAmount(loan)), date: today() })} style={styles.detailAction} />
        <Button label="Edit loan" variant="secondary" onPress={() => { setDirection(loan.direction); setReminder(loan.reminderEnabled ?? loan.reminderIds.length > 0); openForm('loan', { amount: String(loan.amount), date: loan.date, dueDate: loan.dueDate, note: loan.note, attachmentUrl: loan.attachmentUrl }, loan.id); }} style={styles.detailAction} />
      </View>
      <Button label="Delete loan" variant="destructive" size="compact" onPress={deleteLoan} style={styles.detailDeleteAction} />
      <Text style={[styles.section, styles.paymentSection]}>Payment history</Text>
      {loan.payments.length === 0 ? <EmptyState icon="receipt-outline" title="No payments recorded" hint="Payments for this loan will appear here." /> : loan.payments.map((p) => <Card key={p.id} style={styles.listCard}><View style={{ flex: 1 }}><Text style={styles.personName}>{formatMoney(p.amount)} · {formatLoanDate(p.date)}</Text><Text style={{ color: colors.textSecondary }}>{p.note || 'Payment'}</Text></View>{actionButton('Edit', () => openForm('editPayment', { amount: String(p.amount), date: p.date, note: p.note }, p.id))}{deleteActionButton(() => deletePayment(p.id))}</Card>)}
      {loan.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{loan.note}</Text> : null}
      {loan.attachmentUrl ? <Image source={{ uri: loan.attachmentUrl }} style={styles.proof} /> : null}
    </ScrollView> : person ? <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title={person.name} subtitle="Contact details and loan history." style={styles.pageHeading} />
      <Pressable accessibilityRole="button" onPress={() => setPersonId(null)} style={styles.back}><Ionicons name="chevron-back" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>People</Text></Pressable>
      <Card style={styles.personHero}>{person.photoUrl ? <Image source={{ uri: person.photoUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.initials, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.primary, fontWeight: '900', fontSize: 20 }}>{person.name[0]?.toUpperCase()}</Text></View>}<View style={{ flex: 1 }}><Text style={styles.personName}>{person.name}</Text><Text style={{ color: colors.textSecondary }}>{person.phone || 'No phone number'}</Text><Text style={[styles.balance, { color: personBalance(person.id) >= 0 ? colors.success : colors.danger }]}>{personBalance(person.id) >= 0 ? 'Owes you ' : 'You owe '}{formatMoney(Math.abs(personBalance(person.id)))}</Text></View></Card>
      {hasPhone
        ? <View style={styles.row}>{actionButton('Call', () => void openContact(`tel:${phoneDigits}`, 'phone'), false, !canContact)}{actionButton('WhatsApp', () => void openContact(`https://wa.me/${phoneDigits}`, 'WhatsApp'), false, !canContact)}</View>
        : <Pressable accessibilityRole="button" onPress={() => openForm('person', person, person.id)} style={styles.addPhoneAction}><Text style={{ color: colors.primary, fontWeight: '700' }}>Add phone number</Text></Pressable>}
      {hasPhone && !canContact ? <Text style={[styles.phoneValidationHint, { color: colors.danger }]}>{appCopy.loans.invalidPhoneHint}</Text> : null}
      <View style={styles.row}>{actionButton('Add loan', () => { setDirection('gave'); setReminder(true); openForm('loan', { amount: '', date: today(), dueDate: today() }); })}{actionButton('Edit person', () => openForm('person', person, person.id))}</View>
      {person.notes ? <Text style={[styles.note, { color: colors.textSecondary }]}>{person.notes}</Text> : null}
      <Text style={styles.section}>Loans</Text>
      {data.loans.filter((item) => item.personId === person.id).length === 0
        ? <EmptyState icon="wallet-outline" title="No loans with this person" hint="Loans you record with this person will appear here." />
        : data.loans.filter((item) => item.personId === person.id).map((item) => <Card key={item.id} onPress={() => setLoanId(item.id)} style={styles.listCard}><View style={{ flex: 1 }}><Text style={styles.personName}>{item.direction === 'gave' ? 'You gave' : 'You took'} · {formatMoney(item.amount)}</Text><Text style={{ color: colors.textSecondary }}>Due {formatLoanDate(item.dueDate)} · {formatMoney(remainingAmount(item))} remaining</Text></View><Text style={{ color: statusColor(loanStatus(item)), fontWeight: '800', fontSize: 12 }}>{loanStatus(item).toUpperCase()}</Text></Card>)}
    </ScrollView> : showPurchases ? <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title="Planned purchases" subtitle="Plan ahead, buy with confidence." style={styles.pageHeading} />
      <Pressable accessibilityRole="button" onPress={() => setShowPurchases(false)} style={styles.back}><Ionicons name="chevron-back" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Loan dashboard</Text></Pressable>
      <View style={[styles.row, { justifyContent: 'flex-end', marginBottom: 8 }]}>{actionButton('+ Add', () => openForm('purchase', { title: '', targetMonth: toLocalISOMonth(new Date()), reminderDate: today(), note: '' }))}</View>
      <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>Save something you plan to buy and get a reminder on your chosen date.</Text>
      {data.purchaseReminders.length === 0 ? <EmptyState icon="cart-outline" title="No planned purchases" hint="Save a purchase idea to plan it for later." /> : data.purchaseReminders.map((purchase) => <Card key={purchase.id} style={styles.listCard}><View style={{ flex: 1 }}><Text style={styles.personName}>{purchase.title}</Text><Text style={{ color: colors.textSecondary }}>Planned for {formatPurchaseMonth(purchase.targetMonth)} · Reminder {formatShortDate(purchase.reminderDate)}</Text>{purchase.reminderDate < today() ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Reminder passed</Text> : null}{purchase.note ? <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{purchase.note}</Text> : null}</View>{actionButton('Edit', () => openForm('purchase', { title: purchase.title, targetMonth: purchase.targetMonth, reminderDate: purchase.reminderDate, note: purchase.note }, purchase.id))}{deleteActionButton(() => deletePurchase(purchase))}</Card>)}
    </ScrollView> : <FlatList
      data={overviewRows}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      contentContainerStyle={styles.content}
      ListHeaderComponent={overviewHeader}
      ListEmptyComponent={
        <EmptyState
          icon={listMode === 'loans' ? 'wallet-outline' : 'people-outline'}
          title={listMode === 'loans'
            ? data.loans.length === 0 ? 'No loans yet' : 'No matching loans'
            : data.people.length === 0 ? 'No people added' : 'No matching people'}
          hint={listMode === 'loans'
            ? data.loans.length === 0 ? 'Add a person to start tracking money lent or borrowed.' : 'Try another search or filter.'
            : data.people.length === 0 ? 'Add a person to start tracking shared finances.' : 'Try another search.'}
          actionLabel={data.people.length === 0 ? 'Add a person' : undefined}
          onAction={data.people.length === 0 ? () => openForm('person', { name: '', phone: '', notes: '', photoUrl: '' }) : undefined}
        />
      }
      renderItem={renderOverviewRow}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews
    />}
    <AppSheet
      visible={form !== null}
      title={form === 'person' ? editingId ? 'Edit person' : 'Add person' : form === 'loan' ? editingId ? 'Edit loan' : 'Add loan' : form === 'purchase' ? editingId ? 'Edit planned purchase' : 'Plan a purchase' : form === 'editPayment' ? 'Edit payment' : 'Add payment'}
      onClose={() => setForm(null)}
      onSave={() => void saveForm()}
      closeDisabled={busy || saving}
      saveDisabled={busy || saving}
      saveLabel={busy ? 'Uploading…' : saving ? 'Saving…' : 'Save'}
    >
      {form === 'person' ? <>{fieldInput('name', 'Name', { placeholder: 'e.g. Sam Khan' })}{fieldInput('phone', 'Phone', { placeholder: '03xx xxxxxxx', keyboardType: 'phone-pad' })}{fieldInput('notes', 'Notes', { multiline: true, placeholder: 'Anything to remember?' })}{actionButton(fields.photoUrl ? 'Change photo' : 'Add photo', () => void choosePhoto('person'))}{editingId ? <Pressable accessibilityRole="button" onPress={deletePerson} style={styles.sheetDeleteAction}><Text style={[styles.sheetDeleteText, { color: colors.danger }]}>Delete person</Text></Pressable> : null}</> : form === 'loan' ? <><Text style={styles.fieldLabel}>Direction</Text><View style={[styles.row, styles.directionRow]}>{(['gave', 'took'] as const).map((d) => <Pressable key={d} onPress={() => setDirection(d)} style={[styles.direction, { borderColor: direction === d ? colors.primary : colors.border, backgroundColor: direction === d ? colors.primarySoft : colors.background }]}><Text>{d === 'gave' ? 'I gave' : 'I took'}</Text></Pressable>)}</View>{fieldInput('amount', 'Amount', { keyboardType: 'decimal-pad', placeholder: '0.00' })}{dateField('date', 'Date')}{dateField('dueDate', 'Due date')}{fieldInput('note', 'Reason / note', { multiline: true, placeholder: 'Anything to remember?' })}{actionButton(fields.attachmentUrl ? 'Change proof photo' : 'Add proof photo', () => void choosePhoto('loan'))}<View style={styles.switchRow}><Text style={styles.switchLabel}>Remind me before and on the due date</Text><Switch style={styles.reminderSwitch} value={reminder} onValueChange={setReminder} trackColor={{ true: colors.primary }} /></View></> : form === 'purchase' ? <>{fieldInput('title', 'What do you plan to buy?', { placeholder: 'e.g. Laptop' })}{dateField('targetMonth', 'Planned month')}{dateField('reminderDate', 'Remind me on')}{fieldInput('note', 'Note (optional)', { multiline: true, placeholder: 'Anything to remember?' })}</> : <>{fieldInput('amount', 'Amount', { keyboardType: 'decimal-pad', placeholder: '0.00' })}{dateField('date', 'Date')}{fieldInput('note', 'Note', { placeholder: 'e.g. Monthly repayment' })}</>}
      {datePicker && <DateTimePicker value={datePicker.value} mode="date" display={Platform.OS === 'ios' ? 'compact' : 'default'} onChange={onDatePickerChange} />}
    </AppSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 64 },
  pageHeading: { marginHorizontal: -SCREEN_PADDING },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: 8 },
  summaryCard: { width: '48%', flexGrow: 1 },
  overdueTitle: { fontSize: 14, fontWeight: '800' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  summaryAmount: { fontSize: 20, fontWeight: '900', marginTop: 8 },
  summaryCaption: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  netCard: { flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: 12, marginTop: SPACING.md, marginBottom: SPACING.md },
  netCaption: { fontSize: 13, marginTop: 4 },
  netAmount: { fontSize: 22, fontWeight: '900', textAlign: 'right' },
  plannedPurchasesRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, marginBottom: SPACING.md },
  plannedIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  plannedHint: { fontSize: 12, marginTop: 3 },
  listModeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  listModeControl: { flex: 1 },
  section: { fontSize: 18, fontWeight: '900', marginVertical: 12 },
  search: { marginBottom: 12 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  personName: { fontSize: 15, fontWeight: '800' },
  emptyState: { alignItems: 'center' },
  empty: { textAlign: 'center', padding: 24, lineHeight: 21 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingVertical: 8 },
  hero: { marginVertical: 12 },
  bigAmount: { fontSize: 32, fontWeight: '900', marginVertical: 8 },
  status: { fontSize: 12, fontWeight: '900', marginTop: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  iconAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  loanDetailActions: { flexDirection: 'row', gap: 12 },
  detailAction: { flex: 1 },
  detailDeleteAction: { alignSelf: 'center', marginTop: 10 },
  paymentSection: { marginTop: 24 },
  addPhoneAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  phoneValidationHint: { fontSize: 12, marginTop: -4, marginBottom: 8 },
  note: { padding: 12, lineHeight: 20 },
  personHero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 12 },
  avatar: { height: 60, width: 60, borderRadius: 30 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  smallAvatar: { height: 42, width: 42, borderRadius: 21 },
  balance: { marginTop: 7, fontWeight: '900' },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  direction: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  directionRow: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  switchLabel: { flex: 1, minWidth: 0, flexShrink: 1 },
  reminderSwitch: { flexShrink: 0 },
  sheetDeleteAction: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 12, marginTop: 8 },
  sheetDeleteText: { fontSize: 14, fontWeight: '700' },
  proof: { width: '100%', height: 220, borderRadius: 16, marginTop: 14 },
});
