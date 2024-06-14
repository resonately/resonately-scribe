import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TimerProps {
  isRunning: boolean;
  isPaused: boolean;
}

const Timer: React.FC<TimerProps> = ({ isRunning, isPaused }) => {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && !isPaused) {
      if (!startTime) {
        setStartTime(Date.now() - currentTime);
      }

      interval = setInterval(() => {
        setCurrentTime(Date.now() - (startTime || 0));
      }, 10);
    } else if (!isRunning) {
      if (interval) clearInterval(interval as NodeJS.Timeout);
      setCurrentTime(0); // Reset the timer when stopped
      setStartTime(null); // Reset start time
    } else if (isPaused) {
      if (interval) clearInterval(interval as NodeJS.Timeout);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, isPaused, startTime, currentTime]);

  const formatTime = (time: number) => {
    const getHours = String(Math.floor(time / 3600000)).padStart(2, '0');
    const getMinutes = String(Math.floor((time % 3600000) / 60000)).padStart(2, '0');
    const getSeconds = String(Math.floor((time % 60000) / 1000)).padStart(2, '0');
    const getMilliseconds = String(time % 1000).padStart(3, '0').substring(0, 2); // First two digits of milliseconds

    return { getHours, getMinutes, getSeconds, getMilliseconds };
  };

  const { getHours, getMinutes, getSeconds, getMilliseconds } = formatTime(currentTime);

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerText}>
        {getHours}:{getMinutes}:{getSeconds}
      </Text>
      <Text style={styles.millisecondText}>
        .{getMilliseconds}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  timerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    marginTop: 100,
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent', // Transparent background
    elevation: 4,
    flexDirection: 'row',
    position: 'relative',
  },
  timerText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#333',
  },
  millisecondText: {
    fontSize: 20, // Smaller font size for milliseconds
    fontWeight: 'normal',
    position: 'absolute',
    right: -0.01, // Adjust this value to place it correctly
  },
});

export default Timer;
