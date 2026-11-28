import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { usePathname } from "expo-router";
import { useSafeAreaInsets } from
  "react-native-safe-area-context";

import { C, Icon } from "./components";
import { ChatWindow } from "./ChatWindow";
import { useDemo } from "./demo";

export function ChatBubble() {
  const [visible, setVisible] = useState(false);

  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { lang } = useDemo();

  const isArabic = lang === "ar";

  const allowedScreens = [
    "/home",
    "/search",
    "/nearby",
    "/favorites",
  ];

  const showBubble =
    allowedScreens.includes(pathname) ||
    pathname.startsWith("/live-places/");

  return (
    <>
      {showBubble && (
        <View
          style={[
            styles.container,
            {
              bottom: 85 + insets.bottom,
            },
            isArabic
              ? { right: 20 }
              : { left: 20 },
          ]}
        >
          <Pressable
            style={styles.button}
            onPress={() => setVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={
              isArabic
                ? "فتح مساعد عون"
                : "Open AOUN Assistant"
            }
          >
            <Icon name="chat" size={30} />
          </Pressable>
        </View>
      )}

      <ChatWindow
        visible={visible && showBubble}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 999,
  },

  button: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.mint,
    borderWidth: 2,
    borderColor: C.navy,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8,
  },
});