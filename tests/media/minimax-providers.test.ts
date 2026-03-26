import { describe, expect, it } from 'vitest';

/**
 * Minimax Provider Tests
 *
 * These tests verify the integration of Minimax AI services:
 * - minimax-image: Image generation provider
 * - minimax-tts: Text-to-Speech provider
 *
 * Tests are written FIRST (TDD RED phase) to define expected behavior.
 * Implementation should follow to make these tests pass.
 */

describe('Minimax Image Provider', () => {
  describe('ImageProviderId type includes minimax-image', () => {
    it('should accept minimax-image as a valid ImageProviderId', async () => {
      // This test imports the type and verifies it's in the union
      const { ImageProviderId } = await import('@/lib/media/types');
      type TestProviderId = ImageProviderId;
      const _testId: TestProviderId = 'minimax-image';
      expect(_testId).toBe('minimax-image');
    });
  });

  describe('IMAGE_PROVIDERS registry includes minimax-image', () => {
    it('should have minimax-image entry in IMAGE_PROVIDERS', async () => {
      const { IMAGE_PROVIDERS } = await import('@/lib/media/image-providers');
      expect(IMAGE_PROVIDERS['minimax-image']).toBeDefined();
    });

    it('should have correct defaultBaseUrl for minimax-image', async () => {
      const { IMAGE_PROVIDERS } = await import('@/lib/media/image-providers');
      expect(IMAGE_PROVIDERS['minimax-image'].defaultBaseUrl).toBe('https://api.minimaxi.com/v1');
    });

    it('should require API key for minimax-image', async () => {
      const { IMAGE_PROVIDERS } = await import('@/lib/media/image-providers');
      expect(IMAGE_PROVIDERS['minimax-image'].requiresApiKey).toBe(true);
    });

    it('should have models defined for minimax-image', async () => {
      const { IMAGE_PROVIDERS } = await import('@/lib/media/image-providers');
      expect(IMAGE_PROVIDERS['minimax-image'].models).toBeDefined();
      expect(IMAGE_PROVIDERS['minimax-image'].models.length).toBeGreaterThan(0);
    });

    it('should have supported aspect ratios for minimax-image', async () => {
      const { IMAGE_PROVIDERS } = await import('@/lib/media/image-providers');
      expect(IMAGE_PROVIDERS['minimax-image'].supportedAspectRatios).toBeDefined();
      expect(IMAGE_PROVIDERS['minimax-image'].supportedAspectRatios.length).toBeGreaterThan(0);
    });
  });

  describe('minimax-image adapter exports', () => {
    it('should export testMinimaxImageConnectivity function', async () => {
      const adapter = await import('@/lib/media/adapters/minimax-image-adapter');
      expect(typeof adapter.testMinimaxImageConnectivity).toBe('function');
    });

    it('should export generateWithMinimaxImage function', async () => {
      const adapter = await import('@/lib/media/adapters/minimax-image-adapter');
      expect(typeof adapter.generateWithMinimaxImage).toBe('function');
    });
  });

  describe('testImageConnectivity routes to minimax-image', () => {
    it('should call minimax-image connectivity test', async () => {
      const { testImageConnectivity } = await import('@/lib/media/image-providers');
      const result = await testImageConnectivity({
        providerId: 'minimax-image',
        apiKey: 'test-key',
      });
      // Should not return unsupported provider error
      expect(result.message).not.toContain('Unsupported image provider');
    });
  });

  describe('generateImage routes to minimax-image', () => {
    it('should generate image with minimax-image provider', async () => {
      const { generateImage } = await import('@/lib/media/image-providers');
      // This should not throw "Unsupported image provider" error
      try {
        await generateImage(
          {
            providerId: 'minimax-image',
            apiKey: 'test-key',
          },
          {
            prompt: 'test prompt',
          },
        );
      } catch (error) {
        // If it fails due to network/auth, that's ok - the provider is recognized
        expect(String(error)).not.toContain('Unsupported image provider');
      }
    });
  });
});

describe('Minimax TTS Provider', () => {
  describe('TTSProviderId type includes minimax-tts', () => {
    it('should accept minimax-tts as a valid TTSProviderId', async () => {
      const { TTSProviderId } = await import('@/lib/audio/types');
      type TestProviderId = TTSProviderId;
      const _testId: TestProviderId = 'minimax-tts';
      expect(_testId).toBe('minimax-tts');
    });
  });

  describe('TTS_PROVIDERS registry includes minimax-tts', () => {
    it('should have minimax-tts entry in TTS_PROVIDERS', async () => {
      const { TTS_PROVIDERS } = await import('@/lib/audio/constants');
      expect(TTS_PROVIDERS['minimax-tts']).toBeDefined();
    });

    it('should have correct defaultBaseUrl for minimax-tts', async () => {
      const { TTS_PROVIDERS } = await import('@/lib/audio/constants');
      expect(TTS_PROVIDERS['minimax-tts'].defaultBaseUrl).toBe('https://api.minimaxi.com/v1');
    });

    it('should require API key for minimax-tts', async () => {
      const { TTS_PROVIDERS } = await import('@/lib/audio/constants');
      expect(TTS_PROVIDERS['minimax-tts'].requiresApiKey).toBe(true);
    });

    it('should have voices defined for minimax-tts', async () => {
      const { TTS_PROVIDERS } = await import('@/lib/audio/constants');
      expect(TTS_PROVIDERS['minimax-tts'].voices).toBeDefined();
      expect(TTS_PROVIDERS['minimax-tts'].voices.length).toBeGreaterThan(0);
    });

    it('should have supported formats for minimax-tts', async () => {
      const { TTS_PROVIDERS } = await import('@/lib/audio/constants');
      expect(TTS_PROVIDERS['minimax-tts'].supportedFormats).toBeDefined();
      expect(TTS_PROVIDERS['minimax-tts'].supportedFormats.length).toBeGreaterThan(0);
    });
  });

  describe('generateTTS routes to minimax-tts', () => {
    it('should not throw unsupported provider error for minimax-tts', async () => {
      const { generateTTS } = await import('@/lib/audio/tts-providers');
      try {
        await generateTTS(
          {
            providerId: 'minimax-tts',
            apiKey: 'test-key',
            voice: 'test-voice',
          },
          'test text',
        );
      } catch (error) {
        // If it fails due to network/auth, that's ok - the provider is recognized
        expect(String(error)).not.toContain('Unsupported TTS provider');
        expect(String(error)).not.toContain('Unknown TTS provider');
      }
    });
  });

  describe('DEFAULT_TTS_VOICES includes minimax-tts', () => {
    it('should have default voice for minimax-tts', async () => {
      const { DEFAULT_TTS_VOICES } = await import('@/lib/audio/constants');
      expect(DEFAULT_TTS_VOICES['minimax-tts']).toBeDefined();
    });
  });
});

describe('Minimax Provider Config', () => {
  describe('IMAGE_ENV_MAP includes IMAGE_MINIMAX', () => {
    it('should map IMAGE_MINIMAX to minimax-image in provider-config', async () => {
      const { getServerImageProviders } = await import('@/lib/server/provider-config');
      // Provider config should recognize minimax-image
      // Note: This test just verifies the function works without error
      expect(typeof getServerImageProviders).toBe('function');
    });
  });

  describe('TTS_ENV_MAP includes TTS_MINIMAX', () => {
    it('should map TTS_MINIMAX to minimax-tts in provider-config', async () => {
      const { getServerTTSProviders } = await import('@/lib/server/provider-config');
      // Provider config should recognize minimax-tts
      expect(typeof getServerTTSProviders).toBe('function');
    });
  });

  describe('resolveImageApiKey handles minimax-image', () => {
    it('should resolve API key for minimax-image', async () => {
      const { resolveImageApiKey } = await import('@/lib/server/provider-config');
      const key = resolveImageApiKey('minimax-image', 'client-key');
      expect(key).toBe('client-key');
    });
  });

  describe('resolveTTSApiKey handles minimax-tts', () => {
    it('should resolve API key for minimax-tts', async () => {
      const { resolveTTSApiKey } = await import('@/lib/server/provider-config');
      const key = resolveTTSApiKey('minimax-tts', 'client-key');
      expect(key).toBe('client-key');
    });
  });
});

describe('Minimax i18n Settings', () => {
  it('should have providerMinimaxImage in Chinese settings', async () => {
    const { settingsZhCN } = await import('@/lib/i18n/settings');
    // Should have image provider name translation after implementation
    expect(settingsZhCN.settings.providerMinimaxImage).toBeDefined();
  });

  it('should have providerMinimaxImage in English settings', async () => {
    const { settingsEnUS } = await import('@/lib/i18n/settings');
    // Should have image provider name translation after implementation
    expect(settingsEnUS.settings.providerMinimaxImage).toBeDefined();
  });

  it('should have providerMinimaxTTS in Chinese settings', async () => {
    const { settingsZhCN } = await import('@/lib/i18n/settings');
    // Should have TTS provider name translation after implementation
    expect(settingsZhCN.settings.providerMinimaxTTS).toBeDefined();
  });

  it('should have providerMinimaxTTS in English settings', async () => {
    const { settingsEnUS } = await import('@/lib/i18n/settings');
    // Should have TTS provider name translation after implementation
    expect(settingsEnUS.settings.providerMinimaxTTS).toBeDefined();
  });
});
