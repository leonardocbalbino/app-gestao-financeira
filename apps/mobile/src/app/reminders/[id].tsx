import { useLocalSearchParams } from 'expo-router';
import { ReminderFormScreen } from '@/features/reminders/ReminderFormScreen';

export default function EditReminder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReminderFormScreen id={id} />;
}
