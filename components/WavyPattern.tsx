import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface WavyPatternProps {
  data: number[];
  width: number;
  height: number;
  strokeColor?: string;
  strokeWidth?: number;
}

const WavyPattern: React.FC<WavyPatternProps> = ({
  data,
  width,
  height,
  strokeColor = 'blue',
  strokeWidth = 2,
}) => {
  const [amplitude, setAmplitude] = useState(height / 50);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [animatedValue]);

  // Function to simulate receiving continuous stream of inputs
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate a new input value for amplitude
      const newAmplitude = Math.random() * height / 25;
      setAmplitude(newAmplitude);
    }, 1000);

    return () => clearInterval(interval);
  }, [height]);

  const generatePath = (data: number[], phase: number): string => {
    if (data.length === 0) return '';

    const step = width / (data.length - 1);
    let path = `M0,${height / 2}`;

    data.forEach((point, index) => {
      const x = step * index;
      const y = height / 2 + amplitude * Math.sin((index / data.length) * 2 * Math.PI * 1 + phase); // frequency is always 1 now
      path += ` L${x},${y}`;
    });

    return path;
  };

  const pathRef = useRef<Path>(null);

  useEffect(() => {
    const id = animatedValue.addListener(({ value }) => {
      const phase = value * 2 * Math.PI;
      const pathData = generatePath(data, phase);
      if (pathRef.current) {
        pathRef.current.setNativeProps({ d: pathData });
      }
    });
    return () => {
      animatedValue.removeListener(id);
    };
  }, [animatedValue, data, amplitude]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Path
          ref={pathRef}
          d={generatePath(data, 0)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default WavyPattern;
