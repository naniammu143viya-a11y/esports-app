import { registerRootComponent } from 'expo';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Battle Zone Esports App is Live!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  text: { color: '#00ffcc', fontSize: 20, fontWeight: 'bold' }
});

registerRootComponent(App);
