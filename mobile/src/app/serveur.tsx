import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/screen-header";
import { ServerSettings } from "@/components/server-settings";
import { makeStyles } from "@/theme/theme";

/** « Adresse du serveur », accessible avant la connexion (roue dentée) et depuis le compte. */
export default function ServeurScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={s.screen}>
      <ScreenHeader kicker="Réglages" title="Serveur" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ServerSettings />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({ screen: { flex: 1, backgroundColor: t.bg } }),
);
