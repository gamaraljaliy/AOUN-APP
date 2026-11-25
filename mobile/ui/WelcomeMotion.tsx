import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, type ViewStyle } from "react-native";

export function WelcomeMotion({
  children,
  style,
  horizontalOffset,
}: {
  children: ReactNode;
  style?: ViewStyle;
  horizontalOffset?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    function show(reduced: boolean) {
      if (!active) return;
      progress.stopAnimation();
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: horizontalOffset === undefined ? 560 : 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      }).start();
    }
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => {
      preferenceChanged = true;
      show(reduced);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(
      (reduced) => { if (!preferenceChanged) show(reduced); },
      () => show(true),
    );
    return () => {
      active = false;
      subscription.remove();
      progress.stopAnimation();
    };
  }, [horizontalOffset, progress]);

  const from = (value: number, end: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [value, end] });
  return (
    <Animated.View style={[style, {
      opacity: progress,
      transform: horizontalOffset === undefined
        ? [{ translateY: from(14, 0) }, { scale: from(0.9, 1) }]
        : [{ translateX: from(horizontalOffset, 0) }],
    }]}>
      {children}
    </Animated.View>
  );
}
