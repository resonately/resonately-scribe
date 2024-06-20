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

  const durationText = durationInSeconds < 60
    ? `${durationInSeconds.toFixed(0)} s`
    : durationInSeconds < 3600
    ? `${Math.floor(durationInSeconds / 60)} m ${Math.floor(durationInSeconds % 60)} s`
    : `${Math.floor(durationInSeconds / 3600)} h ${Math.floor((durationInSeconds % 3600) / 60)} m ${Math.floor(durationInSeconds % 60)} s`;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.date}>{new Date(recording.startDate).toLocaleString()}</Text>
        <View
          style={[
            styles.statusPill,
            recording.status === 'In Progress'
              ? { backgroundColor: '#FFF176' }
              : recording.status === 'Recording'
              ? { backgroundColor: '#90CAF9' }
              : recording.status === 'Uploading'
              ? { backgroundColor: '#FFCC80' }
              : recording.status === 'Failed'
              ? { backgroundColor: '#EF9A9A' }
              : { backgroundColor: '#77DD77' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              recording.status === 'In Progress' || recording.status === 'Recording' || recording.status === 'Uploading'
                ? { color: '#212121' }
                : { color: '#FFFFFF' },
            ]}
          >
            {recording.status}
          </Text>
        </View>
      </View>
      <Text style={styles.duration}>{durationText}</Text>
    </View>
  );
};

interface RecordingListProps {
  recordings: Recording[];
}

const RecordingList = ({ recordings }: RecordingListProps): JSX.Element => {
  if (recordings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Welcome! Start recording for a better day!</Text>
      </View>
    );
  }

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
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
    color: '#424242',
  },
  statusPill: {
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  duration: {
    fontSize: 14,
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#888888',
  },
});

export default RecordingList;
