import satori, { type SatoriOptions } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadEmoji, getIconCode, type EmojiType } from './emoji';
import type { SvelteComponentTyped, ComponentType } from 'svelte';
import { html as toReactNode } from 'satori-html';
import NotoSans from './noto-sans-v27-latin-regular.ttf';

const isDev = globalThis?.process?.env?.NODE_ENV === 'development';

export type ImageResponseOptions = ConstructorParameters<typeof Response>[1] & {
	/**
	 * The width of the image.
	 *
	 * @type {number}
	 * @default 1200
	 */
	width?: number;
	/**
	 * The height of the image.
	 *
	 * @type {number}
	 * @default 630
	 */
	height?: number;
	/**
	 * Display debug information on the image.
	 *
	 * @type {boolean}
	 * @default false
	 */
	debug?: boolean;
	/**
	 * A list of fonts to use.
	 *
	 * @type {{ data: ArrayBuffer; name: string; weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900; style?: 'normal' | 'italic' }[]}
	 * @default Noto Sans Latin Regular.
	 */
	fonts?: SatoriOptions['fonts'];
	/**
	 * Using a specific Emoji style. Defaults to `twemoji`.
	 *
	 * @link https://github.com/vercel/og#emoji
	 * @type {EmojiType}
	 * @default 'twemoji'
	 */
	emoji?: EmojiType;
};

// @TODO: Support font style and weights, and make this option extensible rather
// than built-in.
// @TODO: Cover most languages with Noto Sans.
const languageFontMap = {
	zh: 'Noto+Sans+SC',
	ja: 'Noto+Sans+JP',
	ko: 'Noto+Sans+KR',
	th: 'Noto+Sans+Thai',
	he: 'Noto+Sans+Hebrew',
	ar: 'Noto+Sans+Arabic',
	bn: 'Noto+Sans+Bengali',
	ta: 'Noto+Sans+Tamil',
	te: 'Noto+Sans+Telugu',
	ml: 'Noto+Sans+Malayalam',
	devanagari: 'Noto+Sans+Devanagari',
	unknown: 'Noto+Sans'
};

async function loadGoogleFont(font: string, text: string) {
	if (!font || !text) return;

	const API = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`;

	const css = await (
		await fetch(API, {
			headers: {
				// Make sure it returns TTF.
				'User-Agent':
					'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'
			}
		})
	).text();

	const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);
	if (!resource) throw new Error('Failed to load font');

	return fetch(resource[1]).then((res) => res.arrayBuffer());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assetCache = new Map<string, any>();
const loadDynamicAsset = ({ emoji }: { emoji?: EmojiType }) => {
	const fn = async (code: string, text: string) => {
		if (code === 'emoji') {
			// It's an emoji, load the image.
			return (
				`data:image/svg+xml;base64,` +
				btoa(await (await loadEmoji(getIconCode(text), emoji)).text())
			);
		}

		// Try to load from Google Fonts.
		if (!languageFontMap[code as keyof typeof languageFontMap]) code = 'unknown';

		try {
			const data = await loadGoogleFont(
				languageFontMap[code as keyof typeof languageFontMap],
				text
			);

			if (data) {
				return {
					name: `satori_${code}_fallback_${text}`,
					data,
					weight: 400,
					style: 'normal'
				};
			}
		} catch (e) {
			console.error('Failed to load dynamic font for', text, '. Error:', e);
		}
	};

	return async (...args: Parameters<typeof fn>) => {
		const key = JSON.stringify(args);
		const cache = assetCache.get(key);
		if (cache) return cache;

		const asset = await fn(...args);
		assetCache.set(key, asset);
		return asset;
	};
};

export function imageResponse<T extends Record<string, unknown>>(
	// my god, this type
	component: ComponentType<SvelteComponentTyped<T, Record<string, unknown>, Record<string, never>>>,
	props: T = {} as T,
	options: ImageResponseOptions = {}
) {
	const extendedOptions = Object.assign(
		{
			width: 1200,
			height: 630,
			debug: false
		},
		options
	);

	const result = new ReadableStream({
		async start(controller) {
			// @ts-expect-error - Svelte's component typings are weird
			const rendered = component.render(props);
			const element = toReactNode(`${rendered.html}<style>${rendered.css.code}</style>`);

			const svg = await satori(element, {
				width: extendedOptions.width,
				height: extendedOptions.height,
				debug: extendedOptions.debug,
				fonts: extendedOptions.fonts || [
					{
						name: 'sans serif',
						data: Buffer.from(NotoSans),
						weight: 700,
						style: 'normal'
					}
				],
				loadAdditionalAsset: loadDynamicAsset({
					emoji: extendedOptions.emoji
				})
			});

			const resvgJS = new Resvg(svg, {
				fitTo: {
					mode: 'width',
					value: extendedOptions.width
				}
			});

			controller.enqueue(resvgJS.render().asPng());
			controller.close();
		}
	});

	return new Response(result, {
		headers: {
			'content-type': 'image/png',
			'cache-control': isDev
				? 'no-cache, no-store'
				: 'public, immutable, no-transform, max-age=31536000',
			...extendedOptions.headers
		},
		status: extendedOptions.status,
		statusText: extendedOptions.statusText
	});
}
