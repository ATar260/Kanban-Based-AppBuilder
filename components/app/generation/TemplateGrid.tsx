"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

export interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
  color: string;
  features: string[];
  preview?: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Admin dashboard with charts and data tables",
    prompt: "Build an admin dashboard with a sidebar navigation, top header with user profile, stats cards showing KPIs, a line chart for trends, a bar chart for comparisons, and a data table with pagination.",
    icon: "📊",
    color: "#3B82F6",
    features: ["Charts", "Tables", "KPIs"],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Product listing with cart and checkout",
    prompt: "Create an e-commerce product page with a product grid, filters sidebar, product cards with images and prices, a shopping cart drawer, and a checkout form with payment fields.",
    icon: "🛒",
    color: "#10B981",
    features: ["Products", "Cart", "Checkout"],
  },
  {
    id: "blog",
    name: "Blog",
    description: "Blog with posts, categories, and comments",
    prompt: "Build a blog homepage with featured post hero, post grid with thumbnails and excerpts, category sidebar, newsletter signup, and a single post view with author info and comments section.",
    icon: "📝",
    color: "#8B5CF6",
    features: ["Posts", "Categories", "Comments"],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Personal portfolio with projects showcase",
    prompt: "Create a personal portfolio site with an about section, skills list with progress bars, project gallery with modal previews, work experience timeline, and contact form.",
    icon: "💼",
    color: "#F59E0B",
    features: ["Projects", "Skills", "Contact"],
  },
  {
    id: "pricing",
    name: "Pricing Page",
    description: "SaaS pricing with feature comparison",
    prompt: "Build a pricing page with 3 pricing tiers (Basic, Pro, Enterprise), monthly/yearly toggle, feature comparison table, FAQ accordion, and a CTA section.",
    icon: "💰",
    color: "#EC4899",
    features: ["Tiers", "Comparison", "FAQ"],
  },
  {
    id: "landing",
    name: "Landing Page",
    description: "Marketing landing with hero and features",
    prompt: "Create a modern SaaS landing page with a hero section featuring a headline, subheadline, and CTA button. Include a features grid with icons, a testimonials section, pricing cards, and a footer with links.",
    icon: "🚀",
    color: "#fa5d19",
    features: ["Hero", "Features", "CTA"],
  },
];

interface TemplateGridProps {
  templates?: Template[];
  onSelectTemplate: (template: Template) => void;
  disabled?: boolean;
  className?: string;
}

export default function TemplateGrid({
  templates = TEMPLATES,
  onSelectTemplate,
  disabled = false,
  className,
}: TemplateGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {templates.map((template, idx) => (
        <TemplateCard
          key={template.id}
          template={template}
          onClick={() => onSelectTemplate(template)}
          disabled={disabled}
          index={idx}
        />
      ))}
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onClick: () => void;
  disabled?: boolean;
  index: number;
}

function TemplateCard({ template, onClick, disabled, index }: TemplateCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "group relative w-full text-left rounded-2xl overflow-hidden",
        "bg-white border-2 border-gray-100",
        "transition-all duration-300",
        "hover:border-gray-200 hover:shadow-xl hover:shadow-gray-200/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Preview area with gradient background */}
      <div
        className="relative h-32 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${template.color}15 0%, ${template.color}05 100%)`,
        }}
      >
        {/* Large emoji icon */}
        <motion.span
          className="text-5xl"
          animate={{
            scale: isHovered ? 1.1 : 1,
            rotate: isHovered ? [0, -5, 5, 0] : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          {template.icon}
        </motion.span>

        {/* Decorative elements */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 -translate-y-1/2 translate-x-1/2"
          style={{ background: template.color }}
        />
        <div
          className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10 translate-y-1/2 -translate-x-1/2"
          style={{ background: template.color }}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>

        {/* Feature tags */}
        <div className="flex flex-wrap gap-1.5">
          {template.features.map((feature) => (
            <span
              key={feature}
              className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* Hover overlay */}
      <motion.div
        initial={false}
        animate={{
          opacity: isHovered ? 1 : 0,
          y: isHovered ? 0 : 10,
        }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-center pb-6 pointer-events-none"
      >
        <span
          className="px-4 py-2 rounded-lg font-semibold text-sm text-white"
          style={{ background: template.color }}
        >
          Use this template
        </span>
      </motion.div>
    </motion.button>
  );
}
