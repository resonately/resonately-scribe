import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';

interface Recording {
  id: string;
  startDate: string;
  endDate: string | null;
  status: string;
}

interface RecordingCardProps {
  recording: Recording;
}

const RecordingCard = ({ recording }: RecordingCardProps): JSX.Element => {
  const durationInSeconds = recording.endDate
    ? (new Date(recording.endDate).getTime() - new Date(recording.startDate).getTime()) / 1000
    : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.date}>{new Date(recording.startDate).toLocaleString()}</Text>
        <View
          style={[
            styles.statusPill,
            recording.status === 'In Progress'
              ? { backgroundColor: 'yellow' }
              : recording.status === 'Uploading'
              ? { backgroundColor: 'orange' }
              : recording.status === 'Failed'
              ? { backgroundColor: 'red' }
              : { backgroundColor: '#4CAF50' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              recording.status === 'In Progress' || recording.status === 'Uploading'
                ? { color: 'black' }
                : { color: 'white' },
            ]}
          >
            {recording.status}
          </Text>
        </View>
      </View>
      <Text style={styles.duration}>{durationInSeconds.toFixed(2)} s</Text>
    </View>
  );
};

interface RecordingListProps {
  recordings: Recording[];
  onDelete: (id: string) => void;
}

const RecordingList = ({ recordings }: RecordingListProps): JSX.Element => {
  return (
    <FlatList
      data={recordings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RecordingCard recording={item} />
      )}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    margin: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusPill: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  duration: {
    fontSize: 14,
    color: '#555',
  },
});

export default RecordingList;
