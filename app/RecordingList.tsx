import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';

interface Recording {
  id: string;
  startDate: string;
  endDate: string | null;
  status: string;
  uploadProgress: number; // New property to hold the upload progress percentage
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
      <View style={styles.durationContainer}>
        <Text style={styles.duration}>{durationText}</Text>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${recording.uploadProgress}%` }]} />
        </View>
      </View>
    </View>
  );
};

interface RecordingListProps {
  recordings: Recording[];
  onDelete: (id: string) => void;
}

const RecordingList = ({ recordings, onDelete }: RecordingListProps): JSX.Element => {
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
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duration: {
    fontSize: 14,
    color: '#555',
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginLeft: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
  },
});

export default RecordingList;
