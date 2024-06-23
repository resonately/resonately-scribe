import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native';

interface TimerProps {
  isRunning: boolean;
  isPaused: boolean;
  initialStartTime: number | null;
}

const Timer: React.FC<TimerProps> = ({ isRunning = false, isPaused = false, initialStartTime = null }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const elapsedTimeRef = useRef(0); // To track the elapsed time when paused
  const startTimeRef = useRef<number | null>(initialStartTime);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const frameRef = useRef<number | null>(null);

  const updateTime = useCallback(() => {
    setCurrentTime(Date.now() - (startTimeRef.current || 0));
    frameRef.current = requestAnimationFrame(updateTime);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!');
      if (isRunning) {
        startTimer();
      }
    }

    if (nextAppState === 'background') {
      console.log('App is in the background');
      stopTimer();
    }

    setAppState(nextAppState);
  };

  const startTimer = useCallback(() => {
    if (!startTimeRef.current) {
      const initialStartTime = Date.now() - elapsedTimeRef.current;
      startTimeRef.current = initialStartTime;
    }
    frameRef.current = requestAnimationFrame(updateTime);
  }, [updateTime]);

  const stopTimer = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialStartTime === null) {
      setCurrentTime(0);
      elapsedTimeRef.current = 0;
      startTimeRef.current = null;
      stopTimer();
      return;
    }

    if (startTimeRef.current !== initialStartTime) {
      startTimeRef.current = initialStartTime;
      setCurrentTime(0);
      elapsedTimeRef.current = 0;
    }

    if (isRunning && appState === 'active') {
      startTimer();
    } else {
      stopTimer();
      if (!isRunning) {
        setCurrentTime(0); // Reset the timer when stopped
        elapsedTimeRef.current = 0;
        startTimeRef.current = null;
      } else if (isPaused) {
        elapsedTimeRef.current = Date.now() - (startTimeRef.current || 0); // Store the elapsed time when paused
      }
    }

    return () => {
      stopTimer();
    };
  }, [isRunning, isPaused, appState, initialStartTime, startTimer, stopTimer]);

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
      {/* <Text style={styles.millisecondText}>
        .{getMilliseconds}
      </Text> */}
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
