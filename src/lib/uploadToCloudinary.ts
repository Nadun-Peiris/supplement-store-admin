export async function uploadToCloudinary(file: File): Promise<string> {
  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject("Failed to convert file");
      }
    };

    reader.onerror = reject;
  });

  // Send to your backend upload API
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: base64 }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Image upload failed");
  }

  return data.url;
}
