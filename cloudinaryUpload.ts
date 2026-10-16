import { File } from "expo-file-system";

type ImageUploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function uploadImage(asset: ImageUploadAsset) {
  const cloudName =
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset =
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary configuration is missing. Check your .env file."
    );
  }

  const uriExtension = asset.uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1];
  const mimeType =
    asset.mimeType ||
    (uriExtension ? `image/${uriExtension.toLowerCase()}` : "image/jpeg");
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const fileName = asset.fileName || `image-${Date.now()}.${extension}`;
  const file = new File(asset.uri);

  const formData = new FormData();
  formData.append("file", {
    name: fileName,
    type: mimeType,
    bytes: () => file.bytes(),
  } as any);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Image upload failed.");
  }

  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
  };
}
