import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors, fonts } from "@/theme/tokens";

/**
 * Écran d'ouverture animé (logo officiel de Green Trek, fichiers de `public/logo/` découpés).
 * Il prend le relais du splash natif (image fixe, même symbole à la même place et à la même
 * taille : 120 points de large au centre), puis :
 * - le symbole monte et grossit avec un léger rebond ;
 * - le nom « GREEN TREK » glisse dessous ;
 * - l'accroche « Explorez Madagascar » apparaît (police manuscrite du site) ;
 * - tout s'efface en douceur sur l'accueil (environ 2 secondes en tout).
 * « Réduire les animations » activé sur le téléphone : simple fondu (cahier des charges §8.5).
 */

/** Largeur du symbole dans le splash natif (`app.json` : image carrée de 200, symbole à 60 %). */
const SYMBOL_WIDTH = 120;
const SYMBOL_RATIO = 325 / 600;
const NAME_WIDTH = 200;
const NAME_RATIO = 59 / 600;

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const symbolY = useSharedValue(0);
  const symbolScale = useSharedValue(1);
  const nameOpacity = useSharedValue(reduced ? 1 : 0);
  const nameY = useSharedValue(reduced ? 0 : 14);
  const taglineOpacity = useSharedValue(reduced ? 1 : 0);
  const taglineX = useSharedValue(reduced ? 0 : -12);
  const screenOpacity = useSharedValue(1);
  const screenScale = useSharedValue(1);

  useEffect(() => {
    const finish = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(onDone);
    };
    if (reduced) {
      screenOpacity.value = withDelay(900, withTiming(0, { duration: 300 }, finish));
      return;
    }
    const spring = { damping: 11, stiffness: 120, mass: 0.9 };
    symbolY.value = withDelay(150, withSpring(-46, spring));
    symbolScale.value = withDelay(150, withSequence(withSpring(1.32, spring), withSpring(1.25)));
    const ease = Easing.out(Easing.cubic);
    nameOpacity.value = withDelay(550, withTiming(1, { duration: 420, easing: ease }));
    nameY.value = withDelay(550, withTiming(0, { duration: 420, easing: ease }));
    taglineOpacity.value = withDelay(900, withTiming(1, { duration: 500, easing: ease }));
    taglineX.value = withDelay(900, withTiming(0, { duration: 500, easing: ease }));
    screenScale.value = withDelay(
      1850,
      withTiming(1.06, { duration: 380, easing: Easing.in(Easing.quad) }),
    );
    screenOpacity.value = withDelay(1850, withTiming(0, { duration: 380 }, finish));
  }, [
    reduced,
    onDone,
    symbolY,
    symbolScale,
    nameOpacity,
    nameY,
    taglineOpacity,
    taglineX,
    screenOpacity,
    screenScale,
  ]);

  const screen = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));
  const symbol = useAnimatedStyle(() => ({
    transform: [{ translateY: symbolY.value }, { scale: symbolScale.value }],
  }));
  const name = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));
  const tagline = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateX: taglineX.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, screen]}
      pointerEvents="none"
      accessibilityLabel="Green Trek"
      accessibilityRole="image"
    >
      {/* Le symbole est centré exactement comme dans le splash natif. */}
      <Animated.View style={[styles.symbol, symbol]}>
        <Image
          source={require("../../assets/images/splash-symbole.png")}
          style={{ width: SYMBOL_WIDTH, height: SYMBOL_WIDTH * SYMBOL_RATIO }}
          contentFit="contain"
        />
      </Animated.View>
      <View style={styles.below}>
        <Animated.View style={name}>
          <Image
            source={require("../../assets/images/splash-nom.png")}
            style={{ width: NAME_WIDTH, height: NAME_WIDTH * NAME_RATIO }}
            contentFit="contain"
          />
        </Animated.View>
        <Animated.Text style={[styles.tagline, tagline]}>Explorez Madagascar</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.teal900,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  symbol: { alignItems: "center", justifyContent: "center" },
  below: {
    position: "absolute",
    top: "50%",
    marginTop: 30,
    alignItems: "center",
    gap: 10,
  },
  tagline: { fontFamily: fonts.script, fontSize: 28, color: colors.cream },
});
