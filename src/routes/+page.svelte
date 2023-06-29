<script lang="ts">
	import { Configuration, OpenAIApi } from "openai";
	import {
		FileDropzone,
		Paginator,
		ProgressRadial,
		Tab,
		TabGroup,
		Table, tableMapperValues, type TableSource, Toast, type ToastSettings, toastStore
	} from '@skeletonlabs/skeleton';
	import { onMount } from 'svelte';
	import Papa from 'papaparse';
	import {loadingGPT, mainGPTSummary} from "../store";
	import {dataIsGood} from "../store.js";

	let files: FileList;
	let tabSet: number = 0;
	let tableCSV: string[] = [''];
	let headers: string[] = ['Responses'];
	let sentimentData = [
		{ item: "filler", sentiment: 'positive'},
	];
	let currentMessage = '';
	let joinedString = '';
	let questionAnswer = '';

	let sentimentTable: TableSource = {
		// A list of heading labels.
		head: ['Item', 'Sentiment'],
		// The data visibly shown in your table body UI.
		body: tableMapperValues(sentimentData, ['item', 'sentiment']),
	};


	let page = {
		offset: 0,
		limit: 3,
		size: tableCSV.length,
		amounts: [1, 2, 3, 5, tableCSV.length],
	};


	const onKeyPress = e => {

		if (e.charCode === 13){
			e.preventDefault()
			askQuestion();
		}
	};

	let questionResponse: ToastSettings = {
		message: '',
		autohide: false
	};

	$: page.size = tableCSV.length;
	$: page.amounts[4] = tableCSV.length;
	$: tableCSVSliced = tableCSV.slice(page.offset * page.limit, page.offset * page.limit + page.limit);

	const configuration = new Configuration({
		apiKey: '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',
	});
	const openai = new OpenAIApi(configuration);

	async function fileDeposited(): Promise<void> {
		const file = files[0];
		Papa.parse(file, {
			complete: function(results) {
				summarizeCSV(results.data as Array<string>);
				tableCSV = results.data as Array<string>;
				console.log(tableCSV)
				$loadingGPT = true;
			}
		});
	}

	async function summarizeCSV(data: string[]) {
		try {
			const summaryPrompt = data.join(' , ');
			joinedString = summaryPrompt;
			const summaryCompletion = await openai.createChatCompletion({
				model: "gpt-3.5-turbo-16k",
				messages: [{role: "system", content: "You are a helpful assistant."}, {role: "user", content: `The following is a list of responses to a subjective survey, please summarize them. Absolutely do not just recite the responses to me. The summary should be unique from the responses that it pertains to. The summary should only be as long as it needs to be. The summary should be readable by a human and flow well and not just be a list.:  ${summaryPrompt}`}],
			});
			$mainGPTSummary=summaryCompletion.data.choices[0].message.content
			$dataIsGood=true;
			sentimentsCSV(data)
		} catch (error) {
			if (error.response) {
				console.log(error.response.status);
				console.log(error.response.data);
			} else {
				console.log(error.message);
			}
		}
	}

	async function sentimentsCSV(data: string[]) {
		try {
			const summaryPrompt = data.join(' , ');
			const summaryCompletion = await openai.createChatCompletion({
				model: "gpt-3.5-turbo-16k",
				messages: [{role: "system", content: "You are a sentiment analysis robot who examines subjective survey results to determine subject sentiments."},{role: "user", content: `You will read responses to a subjective survey. You will identify aspects of the subject of the survey and their corresponding sentiment. You can choose from:\\nvery gegative\\nnegative\\nneutral\\positive\\nvery positive\\nmixed\\n\\nHere is an example of the machine readbale format you will return:\\nhandling,very negative\\nColor,very positive\\nSuspension,mixed\\nVisibility,neutral\\ntTires,positive\\nPrice,negative\\nTrunk size, negative\\n\\nNote the lack of headers\\nYou will return no more than 30 lines of data. Pick the most important aspects. Sort the aspects by how important they seemed to be to the respondents. The aspects should have no commas in them and should be brief, concepts, rather than phrases. Here are the responses:\n${summaryPrompt}`}],
			});

			const csvString = summaryCompletion.data.choices[0].message.content;
			const lines = csvString.trim().split('\n');  // Split by line

			sentimentData = lines.map(line => {
				const [item, sentiment] = line.split(',');  // Split each line by comma
				return { item: item.trim(), sentiment: sentiment.trim() };  // Create object and trim the strings
			});
			console.log(csvString)
			console.log(sentimentData);
			sentimentTable = {
				// A list of heading labels.
				head: ['Item', 'Sentiment'],
				// The data visibly shown in your table body UI.
				body: tableMapperValues(sentimentData, ['item', 'sentiment']),
			};
		} catch (error) {
			if (error.response) {
				console.log(error.response.status);
				console.log(error.response.data);
			} else {
				console.log(error.message);
			}
		}
	}

	async function askQuestion() {
		let sendMessage=currentMessage
		currentMessage=''
		try {
			const summaryCompletion = await openai.createChatCompletion({
				model: "gpt-3.5-turbo-16k",
				messages: [{role: "system", content: "You are a helpful assistant who reviews responses to surveys and responds to questions about the responses"},{role: "user", content: `Here are the responses to the survey:\n${joinedString} \n Here is my question:\n${sendMessage}`}],
			});

			questionAnswer = summaryCompletion.data.choices[0].message.content;

			console.log(questionAnswer);
			questionResponse.message = questionAnswer;
			toastStore.trigger(questionResponse)
		} catch (error) {
			if (error.response) {
				console.log(error.response.status);
				console.log(error.response.data);
			} else {
				console.log(error.message);
			}
		}
	}

</script>

<Toast />

<div class="h-screen grid place-items-center gap-14">

	{#if $dataIsGood}
		<section class="w-1/2 rounded-xl p-4 text-token bg-secondary-500/50 opacity-90 self-end mt-8">
			<TabGroup >
				<Tab bind:group={tabSet} name="summary" value={0}>Summary</Tab>
				<Tab bind:group={tabSet} name="sentiments" value={1}>Sentiments</Tab>
				<Tab bind:group={tabSet} name="chat" value={2}>Chat</Tab>
				<svelte:fragment slot="panel">
					{#if tabSet === 0}
						<p class="text-center">{$mainGPTSummary}</p>
					{:else if tabSet === 1}
						<p>
							{#if sentimentData[0].item!=="filler"}
								<Table source={sentimentTable} />


							{:else}
								<div style="display: flex; justify-content: center; align-items: center; height: 100%; width: 100%;">
									<ProgressRadial ... stroke={100} meter="stroke-tertiary-500" track="stroke-surface-500/30" />
								</div>
							{/if}
						</p>
					{:else if tabSet === 2}


						<div class="input-group input-group-divider grid-cols-[auto_1fr_auto] rounded-container-token">
							<button class="input-group-shim"></button>
							<textarea
									bind:value={currentMessage}
									class="bg-transparent border-0 ring-0"
									name="prompt"
									id="prompt"
									placeholder="Ask a question about the data!"
									rows="1"
									on:keypress={onKeyPress}></textarea>
							<button class="variant-filled-primary" on:click={askQuestion}>Send</button>
						</div>




					{/if}
				</svelte:fragment>
			</TabGroup>
		</section>


		<div style="margin-bottom: 10vh" class="w-1/2 space-y-4 text-token self-start">
			<Table source={{ head: headers, body: tableCSVSliced }} />
			<Paginator
					bind:settings={page}
					showFirstLastButtons={false}
					showPreviousNextButtons={true}
			/>
		</div>

	{:else if !$loadingGPT}

		<div class="w-2/3 lg:w-1/3 h-64 p-6 text-center">
			<FileDropzone bind:files="{files}" on:change="{fileDeposited}" class="w-full h-full">
				<span slot="message" class="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">Drag and drop files here or click to select files</span>
			</FileDropzone>
		</div>

	{:else}

		<ProgressRadial ... stroke={100} meter="stroke-tertiary-500" track="stroke-surface-500/30" />

	{/if}


</div>
