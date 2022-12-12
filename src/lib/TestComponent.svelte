<script lang="ts">
	export let text = "Hello, world! Let's test some emoji: 👋, 🌎";
</script>

<div><span>{text}</span></div>

<style>
	div {
		display: flex;
		justify-content: center;
		align-items: center;
		color: red;
		font-size: 50px;
		height: 100vh;
		width: 100vw;
	}
</style>
