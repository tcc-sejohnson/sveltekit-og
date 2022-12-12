<script lang="ts">
	const promise = async () => {
		const resp = await fetch('/og');
		const text = await resp.text();
		return text;
	};
</script>

{#await promise()}
	<div>loading...</div>
{:then text}
	<div>{@html text}</div>
{/await}
