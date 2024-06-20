import React, { useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

const createAnimationValue = () => new Animated.Value(0.05);

const normalizeVolume = (volume, minVolume = 20, maxVolume = 90) => {
  return ((volume - minVolume) / (maxVolume - minVolume)) * 2;
};

const AnimatedSoundBars = ({ barColor = 'red', isAnimating = false, volume = 1, maxHeight = 10 }) => {
  const dotAnimations = React.useRef(
    Array.from({ length: 50 }).map(createAnimationValue)
  ).current;

  useEffect(() => {
    const normalizedVolume = normalizeVolume(volume);

    dotAnimations.forEach((node, index) => {
      const middleIndex = dotAnimations.length / 2;
      const distanceFromCenter = Math.abs(index - middleIndex) / middleIndex;
      const scaleFactor = Math.cos(distanceFromCenter * Math.PI); // Wave-like effect using cosine
      const randomness = Math.random() * 2 * distanceFromCenter; // Randomness that increases away from the center
      const targetValue = Math.min(0.05 + normalizedVolume * (1 + scaleFactor + randomness), maxHeight); // Ensure it does not exceed maxHeight

      if (isAnimating) {
        Animated.timing(node, {
          toValue: targetValue,
          easing: Easing.ease,
          useNativeDriver: true,
          duration: 200, // Smooth transition duration
        }).start();
      }
    });
  }, [volume, maxHeight]);

  useEffect(() => {
    if (isAnimating) {
      dotAnimations.forEach((node, index) => {
        const middleIndex = dotAnimations.length / 2;
        const distanceFromCenter = Math.abs(index - middleIndex) / middleIndex;
        const scaleFactor = Math.cos(distanceFromCenter * Math.PI); // Wave-like effect using cosine
        const randomness = Math.random() * 2 * (1- distanceFromCenter); // Randomness that increases away from the center
        const targetValue = Math.min(0.05 + normalizeVolume(volume) * (1 + scaleFactor + randomness), maxHeight); // Ensure it does not exceed maxHeight

        Animated.timing(node, {
          toValue: targetValue,
          easing: Easing.ease,
          useNativeDriver: true,
          duration: 100, // Smooth transition duration
        }).start();
      });
    } else {
      Animated.parallel(
        dotAnimations.map((node) =>
          Animated.timing(node, {
            toValue: 0.05, // Settle to smaller height
            easing: Easing.ease,
            useNativeDriver: true,
            duration: 100, // Gradual stop duration
          })
        )
      ).start();
    }
  }, [isAnimating, maxHeight]);

  return (
    <View style={styles.row}>
      {dotAnimations.map((animation, index) => (
        <Animated.View
          key={`${index}`}
          style={[
            styles.bar,
            { backgroundColor: barColor, height: maxHeight }, // Ensure bar height does not exceed maxHeight
            {
              transform: [{ scaleY: animation }],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
  },
  bar: {
    height: 70, // This will be overridden by the maxHeight prop
    width: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});

export default AnimatedSoundBars;