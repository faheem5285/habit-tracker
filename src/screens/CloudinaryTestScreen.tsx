import { useState } from "react";
import {
  View,
  Text,
  Button,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "../../cloudinaryUpload";

export default function CloudinaryTestScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function chooseImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedAsset(result.assets[0]);
        setImageUri(result.assets[0].uri);
        setImageUrl(null);
      }
    } catch (error) {
      Alert.alert(
        "Image selection failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async function handleUpload() {
    if (!imageUri || !selectedAsset) {
      Alert.alert("Select an image", "Please select an image first.");
      return;
    }

    try {
      setLoading(true);

      const uploaded = await uploadImage(selectedAsset);
      setImageUrl(uploaded.url);

      Alert.alert("Success", "Image uploaded to Cloudinary!");
    } catch (error) {
      console.error("Cloudinary upload error:", error);

      Alert.alert(
        "Upload failed",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cloudinary Image Upload</Text>

      <View style={styles.button}>
        <Button
          title="1. Select Image"
          onPress={chooseImage}
          disabled={loading}
        />
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} />
      )}

      <View style={styles.button}>
        <Button
          title={loading ? "Uploading..." : "2. Upload Image"}
          onPress={handleUpload}
          disabled={loading || !imageUri}
        />
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#2563EB"
          style={styles.loader}
        />
      )}

      {imageUrl && (
        <>
          <Text style={styles.success}>Image uploaded successfully!</Text>

          <Image source={{ uri: imageUrl }} style={styles.image} />

          <Text selectable style={styles.url}>
            {imageUrl}
          </Text>

          <View style={styles.button}>
            <Button
              title="3. Save Image URL"
              onPress={() =>
                Alert.alert(
                  "Image uploaded",
                  "Your image URL is ready to use:\n\n" + imageUrl
                )
              }
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    gap: 20,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#172554",
  },
  button: {
    width: "100%",
  },
  loader: {
    marginTop: 12,
  },
  image: {
    width: 220,
    height: 220,
    alignSelf: "center",
    borderRadius: 12,
  },
  success: {
    fontSize: 16,
    fontWeight: "600",
    color: "#15803D",
    textAlign: "center",
  },
  url: {
    fontSize: 12,
    color: "#334155",
  },
});
