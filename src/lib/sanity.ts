import { createClient } from '@sanity/client';

export const PROJECT_ID = 'h1lsk3oi';
export const DATASET = 'sandbox';

export const client = createClient({
	projectId: PROJECT_ID,
	dataset: DATASET,
	apiVersion: '2024-01-01',
	useCdn: true,
	// Add a SANITY_API_TOKEN env var if your dataset is private
});

/**
 * Sanitize a Sanity slug for use as a URL path segment and filesystem directory name.
 * Lowercases, strips characters invalid on Windows (: < > " | ? * \ /), and collapses spaces to hyphens.
 */
export function sanitizeSlug(slug: string): string {
	return slug
		.toLowerCase()
		.replace(/[:<>""|?*\\/]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

type SanityImage = { asset?: { _ref: string } } | null | undefined;
type ImageParams = { w?: number; h?: number; fit?: string };

/**
 * Build a Sanity CDN image URL from an asset reference.
 * Pass optional width/height/fit params to resize via the image pipeline.
 */
export function imageUrl(image: SanityImage, params?: ImageParams): string {
	if (!image?.asset?._ref) return '';
	const match = image.asset._ref.match(/^image-(.+)-(\d+x\d+)-(\w+)$/);
	if (!match) return '';
	const [, hash, dimensions, format] = match;
	const base = `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${hash}-${dimensions}.${format}`;
	if (!params) return base;
	const qs = new URLSearchParams(
		Object.entries(params)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => [k, String(v)])
	).toString();
	return qs ? `${base}?${qs}` : base;
}

type PortableTextChild = {
	_type: string;
	text?: string;
	marks?: string[];
};

type PortableTextBlock = {
	_type: string;
	style?: string;
	children?: PortableTextChild[];
	markDefs?: Array<{ _key: string; _type: string; href?: string }>;
};

/**
 * Convert an array of Portable Text blocks to an HTML string.
 * Handles paragraphs, headings, blockquotes, bold, italic, code, and links.
 */
export function portableTextToHtml(blocks: PortableTextBlock[] | null | undefined): string {
	if (!blocks?.length) return '';
	return blocks
		.filter((b) => b._type === 'block')
		.map((block) => {
			const html = (block.children ?? [])
				.map((child) => {
					let text = (child.text ?? '')
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;');
					const marks = child.marks ?? [];
					if (marks.includes('strong')) text = `<strong>${text}</strong>`;
					if (marks.includes('em')) text = `<em>${text}</em>`;
					if (marks.includes('code')) text = `<code>${text}</code>`;
					for (const markKey of marks) {
						const def = block.markDefs?.find((d) => d._key === markKey && d._type === 'link');
						if (def?.href) {
							text = `<a href="${def.href}">${text}</a>`;
							break;
						}
					}
					return text;
				})
				.join('');
			switch (block.style) {
				case 'h1': return `<h1>${html}</h1>`;
				case 'h2': return `<h2>${html}</h2>`;
				case 'h3': return `<h3>${html}</h3>`;
				case 'h4': return `<h4>${html}</h4>`;
				case 'blockquote': return `<blockquote>${html}</blockquote>`;
				default: return `<p>${html}</p>`;
			}
		})
		.join('\n');
}
