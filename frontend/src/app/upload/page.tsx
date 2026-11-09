"use client";

import React from "react";
import BatchUploader from "@/components/BatchUploader";

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Batch Upload</h1>
        <p className="text-sm text-gray-400 mt-1">
          Upload video clips to automatically generate sample-accurate, professional sound design.
        </p>
      </div>

      <BatchUploader />
    </div>
  );
}

