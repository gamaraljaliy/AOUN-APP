import { StyleSheet } from "react-native";
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fafcfb" },
  body: { padding: 24, gap: 14, paddingTop: 48 },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#173e36",
    textAlign: "right",
  },
  label: { fontSize: 18, textAlign: "right" },
  input: {
    borderWidth: 1,
    borderColor: "#56756d",
    borderRadius: 8,
    padding: 12,
    textAlign: "right",
    fontSize: 18,
  },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: "#326354",
    borderRadius: 8,
  },
  active: { backgroundColor: "#205443" },
  item: {
    textAlign: "right",
    padding: 14,
    fontSize: 18,
    backgroundColor: "#edf4f0",
  },
});
