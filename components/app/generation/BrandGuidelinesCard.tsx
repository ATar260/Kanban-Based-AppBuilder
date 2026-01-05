"use client";

import Image from "next/image";

interface BrandGuidelinesCardProps {
  sourceUrl?: string;
  brandingData: any;
}

export default function BrandGuidelinesCard({ sourceUrl, brandingData }: BrandGuidelinesCardProps) {
  if (!brandingData) return null;

  return (
    <div className="mt-3 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl overflow-hidden max-w-[500px] shadow-sm">
      <div className="bg-[#36322F] px-4 py-3">
        <div className="flex items-center gap-2">
          <Image
            src={`https://www.google.com/s2/favicons?domain=${sourceUrl || ""}&sz=32`}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <div className="text-sm font-semibold text-white">Brand Guidelines</div>
        </div>
      </div>

      <div className="p-4">
        {/* Color Scheme Mode */}
        {brandingData.colorScheme && (
          <div className="mb-4">
            <div className="text-sm">
              <span className="text-gray-600 font-medium">Mode:</span>{" "}
              <span className="font-semibold text-gray-900 capitalize">{brandingData.colorScheme}</span>
            </div>
          </div>
        )}

        {/* Colors */}
        {brandingData.colors && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Colors</div>
            <div className="flex flex-wrap gap-3">
              {brandingData.colors.primary && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: brandingData.colors.primary }}
                  />
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">Primary</div>
                    <div className="text-gray-600 font-mono text-xs">{brandingData.colors.primary}</div>
                  </div>
                </div>
              )}
              {brandingData.colors.accent && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: brandingData.colors.accent }}
                  />
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">Accent</div>
                    <div className="text-gray-600 font-mono text-xs">{brandingData.colors.accent}</div>
                  </div>
                </div>
              )}
              {brandingData.colors.background && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: brandingData.colors.background }}
                  />
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">Background</div>
                    <div className="text-gray-600 font-mono text-xs">{brandingData.colors.background}</div>
                  </div>
                </div>
              )}
              {brandingData.colors.textPrimary && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: brandingData.colors.textPrimary }}
                  />
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">Text</div>
                    <div className="text-gray-600 font-mono text-xs">{brandingData.colors.textPrimary}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Typography */}
        {brandingData.typography && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Typography</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {brandingData.typography.fontFamilies?.primary && (
                <div>
                  <span className="text-gray-600 font-medium">Primary:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.typography.fontFamilies.primary}</span>
                </div>
              )}
              {brandingData.typography.fontFamilies?.heading && (
                <div>
                  <span className="text-gray-600 font-medium">Heading:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.typography.fontFamilies.heading}</span>
                </div>
              )}
              {brandingData.typography.fontSizes?.h1 && (
                <div>
                  <span className="text-gray-600 font-medium">H1 Size:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.typography.fontSizes.h1}</span>
                </div>
              )}
              {brandingData.typography.fontSizes?.h2 && (
                <div>
                  <span className="text-gray-600 font-medium">H2 Size:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.typography.fontSizes.h2}</span>
                </div>
              )}
              {brandingData.typography.fontSizes?.body && (
                <div>
                  <span className="text-gray-600 font-medium">Body Size:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.typography.fontSizes.body}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Spacing */}
        {brandingData.spacing && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Spacing</div>
            <div className="flex flex-wrap gap-4 text-sm">
              {brandingData.spacing.baseUnit && (
                <div>
                  <span className="text-gray-600 font-medium">Base Unit:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.spacing.baseUnit}px</span>
                </div>
              )}
              {brandingData.spacing.borderRadius && (
                <div>
                  <span className="text-gray-600 font-medium">Border Radius:</span>{" "}
                  <span className="font-semibold text-gray-900">{brandingData.spacing.borderRadius}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Button Styles */}
        {brandingData.components?.buttonPrimary && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Button Styles</div>
            <div className="flex flex-wrap gap-3">
              <div>
                <div className="text-xs text-gray-600 mb-1.5 font-medium">Primary Button</div>
                <button
                  className="px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: brandingData.components.buttonPrimary.background,
                    color: brandingData.components.buttonPrimary.textColor,
                    borderRadius: brandingData.components.buttonPrimary.borderRadius,
                    boxShadow: brandingData.components.buttonPrimary.shadow,
                  }}
                >
                  Sample Button
                </button>
              </div>
              {brandingData.components?.buttonSecondary && (
                <div>
                  <div className="text-xs text-gray-600 mb-1.5 font-medium">Secondary Button</div>
                  <button
                    className="px-4 py-2 text-sm font-medium"
                    style={{
                      backgroundColor: brandingData.components.buttonSecondary.background,
                      color: brandingData.components.buttonSecondary.textColor,
                      borderRadius: brandingData.components.buttonSecondary.borderRadius,
                      boxShadow: brandingData.components.buttonSecondary.shadow,
                    }}
                  >
                    Sample Button
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Personality */}
        {brandingData.personality && (
          <div className="text-sm">
            <span className="text-gray-600 font-medium">Personality:</span>{" "}
            <span className="font-semibold text-gray-900 capitalize">
              {brandingData.personality.tone} tone, {brandingData.personality.energy} energy
            </span>
          </div>
        )}

        {/* Target Audience */}
        {brandingData.personality?.targetAudience && (
          <div className="text-sm mt-8">
            <span className="text-gray-600 font-medium">Target:</span>{" "}
            <span className="text-gray-900">{brandingData.personality.targetAudience}</span>
          </div>
        )}
      </div>
    </div>
  );
}


