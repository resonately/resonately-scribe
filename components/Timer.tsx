import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TimerProps {
  isRunning: boolean;
  isPaused: boolean;
}

const Timer: React.FC<TimerProps> = ({ isRunning = false, isPaused = false }) => {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const elapsedTimeRef = useRef(0); // To track the elapsed time when paused
  const startTimeRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);

  const updateTime = () => {
    setCurrentTime(Date.now() - (startTimeRef.current || 0));
    currentTimeRef.current = Date.now() - (startTimeRef.current || 0);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      if (!startTimeRef.current) {
        const initialStartTime = Date.now() - elapsedTimeRef.current;
        setStartTime(initialStartTime);
        startTimeRef.current = initialStartTime;
      }

      interval = setInterval(updateTime, 10);
    } else if (!isRunning) {
      if (interval) clearInterval(interval as NodeJS.Timeout);
      setCurrentTime(0); // Reset the timer when stopped
      setStartTime(null); // Reset start time
      elapsedTimeRef.current = 0;
      startTimeRef.current = null;
    } else if (isPaused) {
      if (interval) clearInterval(interval as NodeJS.Timeout);
      elapsedTimeRef.current = currentTimeRef.current; // Store the elapsed time when paused
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, isPaused]);

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
    marginTop: 5,
    paddingHorizontal: 30,
    paddingVertical: 0,
    borderRadius: 10,
    backgroundColor: 'transparent', // Transparent background
    elevation: 4,
    flexDirection: 'row',
    position: 'relative',
  },
  timerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  millisecondText: {
    fontSize: 15, // Smaller font size for milliseconds
    fontWeight: 'normal',
    position: 'absolute',
    right: -0.01, // Adjust this value to place it correctly
  },
});

export default Timer;
