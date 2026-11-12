import { Platform } from 'react-native';

export type PairedVideoSize = { id: string; videoBytes: number };

export type ConvertResult = {
  convertedIds: string[];
  createdIds: string[];
  skippedIds: string[];
  pendingIds: string[];
  videoBytesSaved: number;
};

type NativeAPI = {
  pairedVideoSizes: (ids: string[]) => Promise<PairedVideoSize[]>;
  convertToStills: (ids: string[]) => Promise<ConvertResult>;
};

const loadNative = (): NativeAPI | null => {
  if (Platform.OS !== 'ios') return null;
  try {
    // Optional so Android and tests do not throw if the module is not linked.
    const { requireOptionalNativeModule } = require('expo') as {
      requireOptionalNativeModule: (name: string) => NativeAPI | null;
    };
    return requireOptionalNativeModule('LivePhotoConvert');
  } catch {
    return null;
  }
};

const Native = loadNative();

export const isConvertSupported = Platform.OS === 'ios' && Native != null;

export async function pairedVideoSizes(ids: string[]): Promise<PairedVideoSize[]> {
  if (!ids.length) return [];
  if (!Native) return ids.map((id) => ({ id, videoBytes: 0 }));
  return Native.pairedVideoSizes(ids);
}

export async function convertToStills(ids: string[]): Promise<ConvertResult> {
  if (!Native) {
    throw new Error('Convert to still is available on iPhone.');
  }
  return Native.convertToStills(ids);
}
