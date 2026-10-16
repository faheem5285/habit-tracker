import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Text } from '../../../components/Themed';
import { useSettings } from '../../../context/SettingsContext';
import { AppStackParams } from '../../../navigation/types';
import { cancelHabitNotifications, scheduleLoanNotifications, schedulePurchaseNotification } from '../../../utils/notifications';
import { uploadImage } from '../../../../cloudinaryUpload';
import { syncRecoveryModule } from '../../../utils/recovery';
import { loadLedger, saveLedger } from '../storage';
import { EMPTY_LEDGER, Loan, LoanLedgerData, LoanPayment, LoanPerson, PurchaseReminder, loanStatus, newId, paymentTotal, remainingAmount } from '../types';

type Props = { navigation: { navigate: (route: keyof AppStackParams) => void } };
type FormKind = 'person' | 'loan' | 'payment' | 'editPayment' | 'purchase' | null;
const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function LoanLedgerScreen({ navigation }: Props) {
  const { colors } = useSettings();
  const [data, setData] = useState<LoanLedgerData>(EMPTY_LEDGER);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [showPurchases, setShowPurchases] = useState(false);
  const [form, setForm] = useState<FormKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<'gave' | 'took'>('gave');
  const [reminder, setReminder] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadLedger().then((value) => { setData(value); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) void saveLedger(data).then(() => syncRecoveryModule('loans')).catch((error) => console.warn('Loan backup sync failed:', error)); }, [data, loaded]);
  const person = data.people.find((p) => p.id === personId);
  const loan = data.loans.find((l) => l.id === loanId);
  const openForm = (kind: Exclude<FormKind, null>, values: Record<string, string> = {}, id: string | null = null) => { setEditingId(id); setFields(values); setForm(kind); };
  const updateField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));
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
      if (reminder && loanStatus(value) !== 'paid') value.reminderIds = await scheduleLoanNotifications(`${person?.name || 'Loan'} · ${money(amount)}`, value.dueDate, value.id);
      setData((prev) => ({ ...prev, loans: existing ? prev.loans.map((item) => item.id === value.id ? value : item) : [...prev.loans, value] }));
      setLoanId(value.id);
    } else if (form === 'payment' || form === 'editPayment') {
      if (!loan) return;
      const amount = Number(fields.amount);
      const old = form === 'editPayment' ? loan.payments.find((p) => p.id === editingId) : undefined;
      const available = remainingAmount(loan) + (old?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0 || amount > available) return Alert.alert('Invalid payment', `Enter an amount up to ${money(available)}.`);
      const payment: LoanPayment = { id: old?.id || newId(), amount, date: fields.date || now, note: fields.note || '' };
      const payments = old ? loan.payments.map((p) => p.id === old.id ? payment : p) : [...loan.payments, payment];
      const next = { ...loan, payments };
      if (remainingAmount(next) <= 0) { await cancelHabitNotifications(next.reminderIds); next.reminderIds = []; }
      else if (next.reminderEnabled && next.reminderIds.length === 0) next.reminderIds = await scheduleLoanNotifications(`${person?.name || 'Loan'} · ${money(next.amount)}`, next.dueDate, next.id);
      replaceLoan(next);
    }
    setForm(null);
  };
  const deletePerson = () => person && Alert.alert('Delete person?', `This also deletes ${person.name}'s loans and payment history.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void Promise.all(data.loans.filter((l) => l.personId === person.id).map((l) => cancelHabitNotifications(l.reminderIds))); setData((prev) => ({ ...prev, people: prev.people.filter((p) => p.id !== person.id), loans: prev.loans.filter((l) => l.personId !== person.id) })); setPersonId(null); setLoanId(null); } }]);
  const deleteLoan = () => loan && Alert.alert('Delete loan?', 'This removes the loan and its payment history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void cancelHabitNotifications(loan.reminderIds); setData((prev) => ({ ...prev, loans: prev.loans.filter((l) => l.id !== loan.id) })); setLoanId(null); } }]);
  const deletePayment = (paymentId: string) => loan && Alert.alert('Delete payment?', 'The remaining balance will be recalculated.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => replaceLoan({ ...loan, payments: loan.payments.filter((p) => p.id !== paymentId) }) }]);
  const deletePurchase = (purchase: PurchaseReminder) => Alert.alert('Delete reminder?', `Remove the reminder for ${purchase.title}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void cancelHabitNotifications(purchase.notificationIds); setData((prev) => ({ ...prev, purchaseReminders: prev.purchaseReminders.filter((item) => item.id !== purchase.id) })); } }]);
  const totals = useMemo(() => {
    let receive = 0; let pay = 0; let overdue = 0; let week = 0;
    const endOfWeek = new Date(); endOfWeek.setDate(endOfWeek.getDate() + 7);
    for (const item of data.loans) { const remaining = remainingAmount(item); if (item.direction === 'gave') receive += remaining; else pay += remaining; if (loanStatus(item) === 'overdue') overdue += remaining; const due = new Date(`${item.dueDate}T23:59:59`); if (remaining > 0 && due >= new Date() && due <= endOfWeek) week += remaining; }
    return { receive, pay, overdue, week };
  }, [data.loans]);
  const personBalance = (id: string) => data.loans.filter((l) => l.personId === id).reduce((sum, l) => sum + (l.direction === 'gave' ? remainingAmount(l) : -remainingAmount(l)), 0);
  const shownPeople = data.people.filter((p) => `${p.name} ${p.phone}`.toLowerCase().includes(query.toLowerCase()));
  const actionButton = (label: string, onPress: () => void, danger = false) => <Pressable onPress={onPress} style={[styles.action, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}><Text style={[styles.actionText, { color: danger ? colors.danger : colors.primary }]}>{label}</Text></Pressable>;
  const fieldInput = (key: string, label: string, options: { keyboardType?: 'default' | 'numeric'; multiline?: boolean; placeholder?: string } = {}) => <View style={styles.field} key={key}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={fields[key] || ''} onChangeText={(v) => updateField(key, v)} placeholder={options.placeholder || label} placeholderTextColor={colors.muted} keyboardType={options.keyboardType} multiline={options.multiline} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }, options.multiline && styles.multiline]} /></View>;
  const statusColor = (status: string) => status === 'paid' ? colors.success : status === 'overdue' ? colors.danger : colors.accent;

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <View style={styles.top}><Pressable onPress={() => { setPersonId(null); setLoanId(null); navigation.navigate('ModuleLauncher'); }} style={styles.home}><Ionicons name="grid-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Modules</Text></Pressable><Text style={styles.screenTitle}>Loan Ledger</Text><View style={{ width: 70 }} /></View>
    {loan ? <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => setLoanId(null)} style={styles.back}><Ionicons name="chevron-back" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>{person?.name || 'Person'}</Text></Pressable>
      <View style={[styles.hero, { backgroundColor: colors.surface }]}><Text style={[styles.eyebrow, { color: colors.muted }]}>{loan.direction === 'gave' ? 'YOU LENT' : 'YOU BORROWED'}</Text><Text style={styles.bigAmount}>{money(loan.amount)}</Text><Text style={{ color: colors.textSecondary }}>Paid {money(paymentTotal(loan))} · Remaining {money(remainingAmount(loan))}</Text><Text style={[styles.status, { color: statusColor(loanStatus(loan)) }]}>{loanStatus(loan).toUpperCase()} · Due {loan.dueDate || 'not set'}</Text></View>
      <View style={styles.row}>{actionButton('Add payment', () => openForm('payment', { amount: String(remainingAmount(loan)), date: today() }))}{actionButton('Edit loan', () => { setDirection(loan.direction); setReminder(loan.reminderEnabled ?? loan.reminderIds.length > 0); openForm('loan', { amount: String(loan.amount), date: loan.date, dueDate: loan.dueDate, note: loan.note, attachmentUrl: loan.attachmentUrl }, loan.id); })}{actionButton('Delete', deleteLoan, true)}</View>
      <Text style={styles.section}>Payment history</Text>
      {loan.payments.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No payments recorded yet.</Text> : loan.payments.map((p) => <View key={p.id} style={[styles.listCard, { backgroundColor: colors.surface }]}><View style={{ flex: 1 }}><Text style={styles.personName}>{money(p.amount)} · {p.date}</Text><Text style={{ color: colors.textSecondary }}>{p.note || 'Payment'}</Text></View>{actionButton('Edit', () => openForm('editPayment', { amount: String(p.amount), date: p.date, note: p.note }, p.id))}{actionButton('×', () => deletePayment(p.id), true)}</View>)}
      {loan.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{loan.note}</Text> : null}
      {loan.attachmentUrl ? <Image source={{ uri: loan.attachmentUrl }} style={styles.proof} /> : null}
    </ScrollView> : person ? <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => setPersonId(null)} style={styles.back}><Ionicons name="chevron-back" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>People</Text></Pressable>
      <View style={[styles.personHero, { backgroundColor: colors.surface }]}>{person.photoUrl ? <Image source={{ uri: person.photoUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.initials, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.primary, fontWeight: '900', fontSize: 20 }}>{person.name[0]?.toUpperCase()}</Text></View>}<View style={{ flex: 1 }}><Text style={styles.personName}>{person.name}</Text><Text style={{ color: colors.textSecondary }}>{person.phone || 'No phone number'}</Text><Text style={[styles.balance, { color: personBalance(person.id) >= 0 ? colors.success : colors.danger }]}>{personBalance(person.id) >= 0 ? 'Owes you ' : 'You owe '}{money(Math.abs(personBalance(person.id)))}</Text></View></View>
      <View style={styles.row}>{actionButton('Add loan', () => { setDirection('gave'); setReminder(true); openForm('loan', { amount: '', date: today(), dueDate: today() }); })}{actionButton('Edit person', () => openForm('person', person, person.id))}{actionButton('Delete', deletePerson, true)}</View>
      {person.notes ? <Text style={[styles.note, { color: colors.textSecondary }]}>{person.notes}</Text> : null}
      <Text style={styles.section}>Loans</Text>
      {data.loans.filter((item) => item.personId === person.id).map((item) => <Pressable key={item.id} onPress={() => setLoanId(item.id)} style={[styles.listCard, { backgroundColor: colors.surface }]}><View style={{ flex: 1 }}><Text style={styles.personName}>{item.direction === 'gave' ? 'You gave' : 'You took'} · {money(item.amount)}</Text><Text style={{ color: colors.textSecondary }}>Due {item.dueDate} · {money(remainingAmount(item))} remaining</Text></View><Text style={{ color: statusColor(loanStatus(item)), fontWeight: '800', fontSize: 11 }}>{loanStatus(item).toUpperCase()}</Text></Pressable>)}
    </ScrollView> : showPurchases ? <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => setShowPurchases(false)} style={styles.back}><Ionicons name="chevron-back" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Loan dashboard</Text></Pressable>
      <View style={styles.sectionRow}><Text style={styles.section}>Planned purchases</Text>{actionButton('+ Add', () => openForm('purchase', { title: '', targetMonth: new Date().toISOString().slice(0, 7), reminderDate: today(), note: '' }))}</View>
      <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>Save something you plan to buy and get a reminder on your chosen date.</Text>
      {data.purchaseReminders.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No planned purchases yet.</Text> : data.purchaseReminders.map((purchase) => <View key={purchase.id} style={[styles.listCard, { backgroundColor: colors.surface }]}><View style={{ flex: 1 }}><Text style={styles.personName}>{purchase.title}</Text><Text style={{ color: colors.textSecondary }}>Planned for {purchase.targetMonth} · Reminder {purchase.reminderDate}</Text>{purchase.note ? <Text style={{ color: colors.muted, marginTop: 4 }}>{purchase.note}</Text> : null}</View>{actionButton('Edit', () => openForm('purchase', { title: purchase.title, targetMonth: purchase.targetMonth, reminderDate: purchase.reminderDate, note: purchase.note }, purchase.id))}{actionButton('×', () => deletePurchase(purchase), true)}</View>)}
    </ScrollView> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summaryGrid}>{[['To receive', totals.receive, colors.success], ['To pay', totals.pay, colors.danger], ['Overdue', totals.overdue, colors.accent], ['Due this week', totals.week, colors.primary]].map(([label, amount, color]) => <View key={String(label)} style={[styles.summaryCard, { backgroundColor: colors.surface }]}><Text style={[styles.eyebrow, { color: colors.muted }]}>{label}</Text><Text style={[styles.summaryAmount, { color: color as string }]}>{money(amount as number)}</Text></View>)}</View>
      <Text style={styles.net}>Net balance: {money(totals.receive - totals.pay)}</Text>
      <View style={[styles.row, { marginBottom: 8 }]}>{actionButton('Planned purchases', () => setShowPurchases(true))}</View>
      <View style={styles.sectionRow}><Text style={styles.section}>People</Text>{actionButton('+ Add', () => openForm('person', { name: '', phone: '', notes: '', photoUrl: '' }))}</View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search people" placeholderTextColor={colors.muted} style={[styles.search, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      {shownPeople.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>Add someone to keep track of money lent or borrowed.</Text> : shownPeople.map((p) => <Pressable key={p.id} onPress={() => setPersonId(p.id)} style={[styles.listCard, { backgroundColor: colors.surface }]}>{p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.smallAvatar} /> : null}<View style={{ flex: 1 }}><Text style={styles.personName}>{p.name}</Text><Text style={{ color: colors.textSecondary }}>{p.phone || 'Tap to view loans'}</Text></View><Text style={{ color: personBalance(p.id) >= 0 ? colors.success : colors.danger, fontWeight: '800' }}>{personBalance(p.id) >= 0 ? '+' : '−'}{money(Math.abs(personBalance(p.id)))}</Text></Pressable>)}
    </ScrollView>}
    <Modal visible={form !== null} transparent animationType="slide" onRequestClose={() => setForm(null)}><View style={styles.modalShade}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}><Text style={styles.modalTitle}>{form === 'person' ? editingId ? 'Edit person' : 'Add person' : form === 'loan' ? editingId ? 'Edit loan' : 'Add loan' : form === 'purchase' ? editingId ? 'Edit planned purchase' : 'Plan a purchase' : form === 'editPayment' ? 'Edit payment' : 'Add payment'}</Text>
      {form === 'person' ? <>{fieldInput('name', 'Name')}{fieldInput('phone', 'Phone')}{fieldInput('notes', 'Notes', { multiline: true })}{actionButton(fields.photoUrl ? 'Change photo' : 'Add photo', () => void choosePhoto('person'))}</> : form === 'loan' ? <><Text style={styles.fieldLabel}>Direction</Text><View style={styles.row}>{(['gave', 'took'] as const).map((d) => <Pressable key={d} onPress={() => setDirection(d)} style={[styles.direction, { borderColor: direction === d ? colors.primary : colors.border, backgroundColor: direction === d ? colors.primarySoft : colors.background }]}><Text>{d === 'gave' ? 'I gave' : 'I took'}</Text></Pressable>)}</View>{fieldInput('amount', 'Amount', { keyboardType: 'numeric' })}{fieldInput('date', 'Date (YYYY-MM-DD)')}{fieldInput('dueDate', 'Due date (YYYY-MM-DD)')}{fieldInput('note', 'Reason / note', { multiline: true })}{actionButton(fields.attachmentUrl ? 'Change proof photo' : 'Add proof photo', () => void choosePhoto('loan'))}<View style={styles.switchRow}><Text>Remind me before and on the due date</Text><Switch value={reminder} onValueChange={setReminder} trackColor={{ true: colors.primary }} /></View></> : form === 'purchase' ? <>{fieldInput('title', 'What do you plan to buy?')}{fieldInput('targetMonth', 'Planned month (YYYY-MM)')}{fieldInput('reminderDate', 'Remind me on (YYYY-MM-DD)')}{fieldInput('note', 'Note (optional)', { multiline: true })}</> : <>{fieldInput('amount', 'Amount', { keyboardType: 'numeric' })}{fieldInput('date', 'Date (YYYY-MM-DD)')}{fieldInput('note', 'Note')}</>}
      <View style={[styles.row, { marginTop: 18 }]}>{actionButton('Cancel', () => setForm(null))}<Pressable disabled={busy} onPress={() => void saveForm()} style={[styles.save, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}><Text style={{ color: colors.surface, fontWeight: '800' }}>{busy ? 'Uploading…' : 'Save'}</Text></Pressable></View>
    </ScrollView></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, top: { paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, home: { flexDirection: 'row', gap: 5, alignItems: 'center', width: 70 }, screenTitle: { fontSize: 19, fontWeight: '900' }, content: { paddingHorizontal: 18, paddingBottom: 36 }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }, summaryCard: { width: '48%', padding: 14, borderRadius: 16, flexGrow: 1 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 }, summaryAmount: { fontSize: 20, fontWeight: '900', marginTop: 8 }, net: { fontSize: 14, fontWeight: '800', marginVertical: 16 }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, section: { fontSize: 18, fontWeight: '900', marginVertical: 12 }, search: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 12 }, listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 9 }, personName: { fontSize: 15, fontWeight: '800' }, empty: { textAlign: 'center', padding: 24, lineHeight: 21 }, back: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }, hero: { borderRadius: 20, padding: 20, marginVertical: 12 }, bigAmount: { fontSize: 32, fontWeight: '900', marginVertical: 8 }, status: { fontSize: 12, fontWeight: '900', marginTop: 12 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }, action: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 }, actionText: { fontWeight: '800', fontSize: 12 }, note: { padding: 12, lineHeight: 20 }, personHero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, marginVertical: 12 }, avatar: { height: 60, width: 60, borderRadius: 30 }, initials: { alignItems: 'center', justifyContent: 'center' }, smallAvatar: { height: 42, width: 42, borderRadius: 21 }, balance: { marginTop: 7, fontWeight: '900' }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }, modal: { padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }, modalTitle: { fontSize: 21, fontWeight: '900', marginBottom: 16 }, field: { marginBottom: 12 }, fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 }, input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }, multiline: { height: 82, textAlignVertical: 'top', paddingTop: 10 }, direction: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, save: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 }, proof: { width: '100%', height: 220, borderRadius: 16, marginTop: 14 } });
