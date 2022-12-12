import { imageResponse } from '$lib/og';
import TestComponent from '$lib/TestComponent.svelte';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const text = url.searchParams.get('message') ?? undefined;
	return imageResponse(TestComponent, { text });
};
