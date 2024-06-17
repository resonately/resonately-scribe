import React, { useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

const createAnimationValue = () => new Animated.Value(0.05);

const AnimatedSoundBars = ({ barColor = 'red', isAnimating = false, volume = 1 }) => {
  const dotAnimations = React.useRef(
    Array.from({ length: 50 }).map(createAnimationValue)
  ).current;

  useEffect(() => {
    const animations = dotAnimations.map((node) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(node, {
            toValue: Math.random() * (volume - 0.05) + 0.05, // Random scale based on volume
            easing: Easing.ease,
            useNativeDriver: true,
            duration: Math.random() * (800 - 400) + 400, // Random duration between 400 and 800 ms
          }),
          Animated.timing(node, {
            toValue: 0.05, // Reset to original scale
            easing: Easing.ease,
            useNativeDriver: true,
            duration: Math.random() * (800 - 400) + 400, // Random duration between 400 and 800 ms
          }),
        ])
      )
    );

    if (isAnimating) {
      Animated.parallel(animations).start();
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

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [isAnimating, volume]);

  return (
    <View style={styles.row}>
      {dotAnimations.map((animation, index) => (
        <Animated.View
          key={`${index}`}
          style={[
            styles.bar,
            { backgroundColor: barColor },
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
    height: 70, // Adjust the height if needed
    width: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});

export default AnimatedSoundBars;
