import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { Image } from "expo-image";
import { router } from "expo-router";

import { C, T, Btn, Card, Icon } from "./components";

import {
  sendMessage,
  type ChatResponse,
} from "../services/assistant";

type Message = {
  role: "user" | "assistant";
  text: string;
  result?: ChatResponse;
};

const welcomeMessage: Message = {
  role: "assistant",
  text: "أهلًا بك! أنا مساعد عون، أخبرني بالمكان الذي تبحث عنه والمرافق التي تحتاجها، وسأساعدك في العثور عليه.",
};

const suggestions = [
  "أبي مقهى فيه منحدرات",
  "أبي مطعم فيه مواقف مخصصة",
  "أبي مكان فيه مصعد ودورة مياه مهيأة",
  "أبي مكان تتوفر فيه لوحات برايل",
];

export function ChatWindow({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    welcomeMessage,
  ]);

  const scrollRef = useRef<ScrollView>(null);
  const sendingRef = useRef(false);

  function resetChat() {
    if (sendingRef.current) return;

    setMessages([welcomeMessage]);
    setInput("");
  }

  async function send(suggestion?: string) {
    const text = (suggestion ?? input).trim();

    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    setInput("");
    setLoading(true);

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        text,
      },
    ]);

    try {
      const result = await sendMessage(text);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: result.message,
          result,
        },
      ]);
    } catch (error) {
      console.error("AOUN Assistant:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: "تعذّر الاتصال بمساعد عون. يرجى المحاولة مرة أخرى.",
        },
      ]);
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.container}
          edges={["top", "bottom", "left", "right"]}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
          >
            {/* Header */}

            <View style={styles.header}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق المحادثة"
                style={styles.closeButton}
              >
                <T color="white" size={28}>
                  ×
                </T>
              </Pressable>

              <View style={{ flex: 1 }}>
                <T bold size={24} color="white">
                  مساعد عون
                </T>

                <T size={13} color="white">
                  في كل مكان لك عون
                </T>
              </View>

              <View style={styles.headerIcon}>
                <Icon name="chat" size={26} />
              </View>
            </View>

            {/* New conversation */}

            <View style={styles.toolbar}>
              <Pressable
                onPress={resetChat}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="بدء محادثة جديدة"
                accessibilityState={{
                  disabled: loading,
                }}
                style={[
                  styles.newChatButton,
                  loading && { opacity: 0.4 },
                ]}
              >
                <T bold size={13}>
                  + محادثة جديدة
                </T>
              </Pressable>

              <View style={styles.status}>
                <View style={styles.statusDot} />

                <T size={12} color={C.muted}>
                  مساعد البحث الذكي
                </T>
              </View>
            </View>

            {/* Conversation */}

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({
                  animated: true,
                })
              }
            >
              {messages.map((message, index) => (
                <View
                  key={index}
                  style={[
                    styles.bubble,

                    message.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <T
                    size={16}
                    color={
                      message.role === "user"
                        ? "white"
                        : C.navy
                    }
                  >
                    {message.text}
                  </T>

                  {/* Search results */}

                  {message.result?.places.map((place) => (
                    <Card
                      key={place.id}
                      style={styles.placeCard}
                    >
                      <View style={styles.placeHeader}>
                        {place.photo_path ? (
                          <Image
                            source={{
                              uri: place.photo_path,
                            }}
                            style={styles.placeImage}
                            contentFit="cover"
                            accessibilityLabel={
                              place.name_ar
                            }
                          />
                        ) : (
                          <View
                            style={styles.imagePlaceholder}
                          >
                            <Icon
                              name="building"
                              size={30}
                            />
                          </View>
                        )}

                        <View style={styles.placeInfo}>
                          <T bold size={20}>
                            {place.name_ar}
                          </T>

                          <T
                            size={13}
                            color={C.muted}
                          >
                            {place.category_ar}
                          </T>

                          {place.level === "accessible" && (
                            <View
                              style={[
                                styles.levelBadge,
                                {
                                  backgroundColor:
                                    "#DDF3E5",
                                },
                              ]}
                            >
                              <T
                                bold
                                size={12}
                                color="#246844"
                              >
                                مهيأ
                              </T>
                            </View>
                          )}

                          {place.level ===
                            "partially_accessible" && (
                            <View
                              style={[
                                styles.levelBadge,
                                {
                                  backgroundColor:
                                    "#FFF1CC",
                                },
                              ]}
                            >
                              <T
                                bold
                                size={12}
                                color="#856000"
                              >
                                مهيأ جزئيًا
                              </T>
                            </View>
                          )}

                          {place.level ===
                            "not_accessible" && (
                            <View
                              style={[
                                styles.levelBadge,
                                {
                                  backgroundColor:
                                    "#FCE2E2",
                                },
                              ]}
                            >
                              <T
                                bold
                                size={12}
                                color="#A63232"
                              >
                                غير مهيأ
                              </T>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Available facilities */}

                      {!!message.result
                        ?.required_facilities.length && (
                        <View
                          style={styles.facilitiesSection}
                        >
                          <T bold size={14}>
                            المرافق المطابقة لطلبك
                          </T>

                          {message.result
                            .required_facilities.map(
                              (facility) => (
                                <View
                                  key={facility}
                                  style={
                                    styles.facilityRow
                                  }
                                >
                                  <View
                                    style={
                                      styles.checkCircle
                                    }
                                  >
                                    <T
                                      bold
                                      center
                                      size={12}
                                      color="#246844"
                                    >
                                      ✓
                                    </T>
                                  </View>

                                  <T size={14}>
                                    {facility}
                                  </T>
                                </View>
                              )
                            )}
                        </View>
                      )}

                      <Btn
                        label="عرض تفاصيل المكان"
                        onPress={() => {
                          onClose();

                          router.push(
                            `/live-places/${place.id}`
                          );
                        }}
                      />
                    </Card>
                  ))}
                </View>
              ))}

              {/* Suggested questions */}

              {messages.length === 1 && !loading && (
                <View style={styles.suggestions}>
                  <T
                    bold
                    size={15}
                    color={C.muted}
                  >
                    يمكنك أن تسألني عن
                  </T>

                  {suggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => send(suggestion)}
                      accessibilityRole="button"
                      accessibilityLabel={suggestion}
                      style={({ pressed }) => [
                        styles.suggestionCard,
                        pressed && {
                          backgroundColor: C.mint,
                        },
                      ]}
                    >
                      <Icon name="chat" size={20} />

                      <View style={{ flex: 1 }}>
                        <T size={14}>
                          {suggestion}
                        </T>
                      </View>

                      <T bold size={18}>
                        ↖
                      </T>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Loading */}

              {loading && (
                <View
                  style={styles.loadingBubble}
                  accessibilityLiveRegion="polite"
                >
                  <ActivityIndicator
                    size="small"
                    color={C.navy}
                  />

                  <T size={14}>
                    جارٍ البحث عن الأماكن المناسبة...
                  </T>
                </View>
              )}
            </ScrollView>

            {/* Message input */}

            <View style={styles.footer}>
              <T
                size={12}
                color={C.muted}
                center
              >
                النتائج تعتمد على بيانات الأماكن المسجلة في عون
              </T>

              <View style={styles.inputRow}>
                <Pressable
                  onPress={() => send()}
                  disabled={!input.trim() || loading}
                  accessibilityRole="button"
                  accessibilityLabel="إرسال الرسالة"
                  accessibilityState={{
                    disabled:
                      !input.trim() || loading,
                  }}
                  style={[
                    styles.sendButton,

                    (!input.trim() || loading) && {
                      opacity: 0.4,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator
                      color="white"
                    />
                  ) : (
                    <T
                      bold
                      center
                      color="white"
                      size={15}
                    >
                      إرسال
                    </T>
                  )}
                </Pressable>

                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="اسأل مساعد عون..."
                  accessibilityLabel="رسالتك إلى مساعد عون"
                  placeholderTextColor={C.muted}
                  maxLength={500}
                  editable={!loading}
                  onSubmitEditing={() => send()}
                  returnKeyType="send"
                  style={styles.input}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },

  header: {
    backgroundColor: C.navy,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },

  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.gray,
  },

  newChatButton: {
    backgroundColor: C.soft,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    minHeight: 44,
    justifyContent: "center",
  },

  status: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#72B995",
  },

  messages: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },

  bubble: {
    padding: 14,
    borderRadius: 20,
    maxWidth: "94%",
  },

  userBubble: {
    backgroundColor: C.navy,
    alignSelf: "flex-end",
    borderBottomRightRadius: 5,
  },

  assistantBubble: {
    backgroundColor: C.soft,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 5,
    gap: 10,
  },

  placeCard: {
    backgroundColor: "white",
    padding: 12,
    gap: 12,
    marginTop: 4,
    borderRadius: 16,
  },

  placeHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },

  placeImage: {
    width: 86,
    height: 86,
    borderRadius: 12,
    backgroundColor: C.soft,
  },

  imagePlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 12,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
  },

  placeInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },

  levelBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },

  facilitiesSection: {
    borderTopWidth: 1,
    borderTopColor: C.gray,
    paddingTop: 10,
    gap: 8,
  },

  facilityRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#DDF3E5",
    alignItems: "center",
    justifyContent: "center",
  },

  suggestions: {
    gap: 10,
    marginTop: 4,
  },

  suggestionCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.gray,
    backgroundColor: "white",
    padding: 14,
    minHeight: 54,
  },

  loadingBubble: {
    flexDirection: "row-reverse",
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: C.soft,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },

  footer: {
    padding: 12,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.gray,
    backgroundColor: "white",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: C.soft,
    paddingHorizontal: 18,
    fontFamily: "Plex",
    fontSize: 15,
    color: C.navy,
    textAlign: "right",
  },

  sendButton: {
    minWidth: 70,
    height: 50,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
});