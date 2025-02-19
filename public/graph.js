import { LAYOUTS } from './constants.js'

import { generateStylesheet, renderStyleRules, updateStyles } from './style-rules.js'
import { sourceLineToID, generateViewName, generateEventURLs, generateEventCodeHTML, generateEventLabel, generateProxyCallLabel, generateURL, generateHighlightedCode, locations, importData, generateElements } from './helpers.js'
import { setupEventSource } from './sse.js';

import { animationDuration } from './animation-duration.js';

import './theme.js';

import { requests, renderInfo, viewInfo, isOffline } from './globals.js'
import { generateLinkedSVG } from './svg.js';

import './backend.js'
import { selfId, upsertData } from './backend.js';

import * as API from './api.js';

marked.setOptions({
	highlight(code, language){
		try {
			return hljs.highlight(code, { language }).value
		} catch (e) {
			return code
		}
	}
})

const markedRenderer = new marked.Renderer();

markedRenderer.link = function(href, title, text) {
	const anchor = document.createElement('a');
	anchor.target = '_blank'
	anchor.href = href;
	anchor.title = title;
	anchor.textContent = text;
	return anchor.outerHTML;
}

let compoundNodes = document.querySelector('#groups').checked
document.querySelector('#groups').addEventListener('change', e => {
	compoundNodes = e.currentTarget.checked;
	cy.json({ elements: generateElements() });
	cy.style(generateStylesheet());
	renderBubbles();
	renderRequestPath()
})

let allEdges = document.querySelector('#allEdges').checked;
document.querySelector('#allEdges').addEventListener('change', e => {
	allEdges = e.currentTarget.checked;
	renderRequestPath();
})

let allNodes = document.querySelector('#allNodes').checked;
document.querySelector('#allNodes').addEventListener('change', e => {
	allNodes = e.currentTarget.checked;
	renderRequestPath();
})

let eventNumbers = document.querySelector('#eventNumbers').checked
document.querySelector('#eventNumbers').addEventListener('change', e => {
	eventNumbers = e.currentTarget.checked;
	renderRequestPath()
})


let eventHighlights = document.querySelector('#eventHighlights').checked
document.querySelector('#eventHighlights').addEventListener('change', e => {
	eventHighlights = e.currentTarget.checked;
	renderRequestPath()
})


let codeTooltips = document.querySelector('#codeTooltips').checked
document.querySelector('#codeTooltips').addEventListener('change', e => {
	codeTooltips = e.currentTarget.checked;
	renderCodeTooltips()
})

const connectionIndicator = document.querySelector('#connection-indicator');

connectionIndicator.addEventListener('click', () => {
	if (!isOffline) return;
	if (localStorage.getItem('importing-requests') && confirm('Clear imported requests?')){
		localStorage.removeItem('importing-requests');
		localStorage.removeItem('importing-info');
		return window.location.reload();
	}
})

if (isOffline) connectionIndicator.dataset.readyState = 'offline';
else {
	connectionIndicator.disabled = true;
	setupEventSource(requests, () => {
		if (!renderInfo.request) renderInfo.request = Object.values(requests)[0]
		renderRequest()
		renderRequestsSelect();
		renderMiddlewaresSelect();
	});
}

window.cy = cytoscape({
	container: document.getElementById('cy-div'),
	elements: generateElements(),
	layout: Object.values(LAYOUTS)[0],
	wheelSensitivity: 0.05
});
window.cy.style(generateStylesheet())
for (const [id, { x, y }] of Object.entries(JSON.parse(localStorage.getItem('locations') || '{}')).sort((a, b) => a[0].split('/').length - b[0].split('/').length)) {
	cy.$(`[id="${id}"]`).position({ x, y });
}
(() => {
	const { zoom, pan } = JSON.parse(localStorage.getItem('info') || '{}');
	if (zoom) cy.zoom(zoom);
	if (pan) cy.pan(pan);
})();

cy.on('dbltap', 'node', function () {
	const url = this.data('href')
	if (!url) return;

	if (url.includes('http')) window.open(url, '_blank');
	else window.location.href = url;
});
cy.on('free', function ({ target }) {
	locations.update(target.data('id'), target.position())
});
cy.on('pan', function () {
	const info = JSON.parse(localStorage.getItem('info') || '{}')
	info.pan = cy.pan()
	localStorage.setItem('info', JSON.stringify(info))
	for (const tip of codeTooltipTippys){
		tip.setProps({ getReferenceClientRect: cy.$(`[id="${tip.r2NodeId}"]`).popperRef().getBoundingClientRect })
	}
	if (!renderInfo.lastNode) return;
	renderInfo.tip.setProps({ getReferenceClientRect: renderInfo.lastNode.popperRef().getBoundingClientRect })
});
cy.on('zoom', function () {
	const info = JSON.parse(localStorage.getItem('info') || '{}')
	info.zoom = cy.zoom()
	localStorage.setItem('info', JSON.stringify(info))
	for (const tip of codeTooltipTippys){
		tip.setProps({ getReferenceClientRect: cy.$(`[id=${tip.r2NodeId}]`).popperRef().getBoundingClientRect })
	}
	if (!renderInfo.lastNode) return;
	renderInfo.tip.setProps({ getReferenceClientRect: renderInfo.lastNode.popperRef().getBoundingClientRect })
});

const bb = cy.bubbleSets();
function renderBubbles() {
	bb.getPaths().forEach(b => bb.removePath(b))
	if (compoundNodes) return;
	const options = {
		virtualEdges: false,
		interactive: false,
		includeLabels: true,
		includeMainLabels: true,
		includeOverlays: true,
		includeSourceLabels: true,
		includeTargetLabels: true, virtualEdges: true, interactive: true,
	}

	if (!renderInfo.request) return;
	const ids = new Set();
	for (const event of renderInfo.request.events) {
		const urls = generateEventURLs(event)
		const remaining = [...'added evaluated construct source error'.split` `.map(key => urls[key]).filter(Boolean).map(u => u.split('//').at(-1)).reverse(), ...(event.type === 'view' ? [viewInfo.views.directory + '/' + generateViewName(event.name)] : [])];

		for (const url of remaining) {
			const target = sourceLineToID(Object.values(cy.elements()).map(cye => {
				if (typeof cye?.data === 'function') return { data: cye.data() }
				else return { data: {} }
			}), url)
			if (target) ids.add(target?.data.id)
		}
	}

	const nodes = cy.filter(e => ids.has(e.data('id')));

	const eids = new Set();
	for (const from of nodes) {
		for (const to of nodes) {
			eids.add(`${from.data('id')}-${to.data('id')}`)
		}
	}
	const edges = cy.filter(e => eids.has(e.data('id')))

	bb.addPath(nodes, edges, null, { ...options, virtualEdges: false })
}

const select = document.querySelector('#layout-options');
select.appendChild(Object.entries(LAYOUTS).reduce((frag, [value, data], i) => {
	const option = document.createElement('option');
	option.textContent = value;
	if (!i) option.selected = true;

	frag.appendChild(option)
	return frag;
}, document.createDocumentFragment()))
select.addEventListener('change', (e) => {
	const value = e.currentTarget.value;
	cy.layout(LAYOUTS[value]).run()
})


function updateWindowHTML(window, body, title, ...buttons) {
	if (body !== undefined) {
		const content = window.querySelector('.mainWindow')

		if (body.type === 'diff') {
			content.innerHTML = jsondiffpatch.formatters.html.format(body.data.delta, body.data.original)
			jsondiffpatch.formatters.html.hideUnchanged();
		} else if (body.type === 'markdown'){
			content.innerHTML = marked.parse(body.string, { renderer: markedRenderer });
		} else {
			let pre = content.querySelector(':scope > pre');
			if (!pre) {
				content.innerHTML = ''
				pre = document.createElement('pre');
				content.appendChild(pre);
			}

			if (body.type === 'code') pre.innerHTML = '<code>' + hljs.highlightAuto(body.string).value + '</code>';
			else pre.innerHTML = body.type === 'innerHTML' ? body.string : escapeHtml(body.string);
		}

	}
	if (title !== undefined) window.querySelector('.windowTitle')[title.type] = title.string;

	const buttonContainer = window.children[0].querySelector('span');
	buttonContainer.innerHTML = '';
	for (const info of buttons){
		const button = document.createElement('button')
		for (const key in info){
			button[key] = info[key]
		}
		buttonContainer.appendChild(button)
	}
}

/**
 * @param {number} id
 * @param {Record<'content' | 'title', { type: 'textContent' | 'innerHTML' | 'code' | 'diff', string: 'string', data?: any } | string>} data
 */
function renderWindow(id, { title, body }, ...buttons) {
	if (typeof body === 'string') body = { type: 'innerHTML', string: body }
	if (typeof title === 'string') title = { type: 'innerHTML', string: title }
	const window = document.querySelector(`#window${id}`);
	window.dataset.body = JSON.stringify(body);
	window.dataset.title = JSON.stringify(title);
	updateWindowHTML(window, body, title, {
		innerHTML: '🗖',
		onclick: () => maximizeMinimizeToggle(window)
	}, ...buttons.filter(Boolean))
}

for (let i = 1; i <= 7; i++){
	const window = document.querySelector('#window' + i);
	updateWindowHTML(window, undefined, undefined, {
		innerHTML: '🗖',
		onclick: () => maximizeMinimizeToggle(window)
	})
}

function maximizeMinimizeToggle(window){
	if (window.dataset.maximized){
		const { top, left, width, height } = JSON.parse(window.dataset.maximized);
		window.style.top = top;
		window.style.left = left;
		window.style.width = width;
		window.style.height = height;
		delete window.dataset.maximized;
	} else {
		window.dataset.maximized = JSON.stringify({ top: window.style.top, left: window.style.left, width: window.style.width, height: window.style.height })
		window.style.top = '1vh';
		window.style.left = '1vw';
		window.style.width = '98vw';
		window.style.height = '93vh';
	}
}

function generateEventNodes(event, forward) {
	const nodes = [];

	const urls = generateEventURLs(event, false)
	const remaining = [...(event.type === 'view' ? [viewInfo.views.directory + '/' + generateViewName(event.name)] : []), ...'added evaluated construct source error'.split` `.map(key => urls[key]).filter(Boolean).map(u => u.replace(viewInfo.filepathPrefix, '')).reverse()];
	if (!forward) remaining.reverse();

	while (remaining.length) {
		const url = remaining.pop()
		const target = sourceLineToID(Object.values(cy.elements()).map(cye => {
			if (typeof cye?.data === 'function') return { data: cye.data() }
			else return { data: {} }
		}), url)

		const node = cy.filter(e => e.data('id') === target?.data.id)[0];
		if (node) nodes.push(node)
	}

	return nodes;
}

function generateEventTooltipContent(event, urls){
	let content = document.createElement('div');

	content.innerHTML = generateEventLabel(event).replace(/\n/g, '<br/>');
	content.innerHTML += '<br/>' + Object.entries(urls).filter(([_, url]) => url && !url.includes('node_modules') && !url.includes('express-handler-tracker')).reduce((lines, [name, url]) => [...lines, `<a ${url.includes('http') ? 'target="_blank"' : ''} href="${url}">${name[0].toUpperCase() + name.slice(1)}</a>`], []).join('<br/>')
	if (event.annotation){
		const annotationContent = event.annotation.split('[//]: # (Start Annotation)').at(1)?.split('[//]: # (End Annotation)')[0].trim()
		if (annotationContent) {
			content.innerHTML += marked.parse(annotationContent, { renderer: markedRenderer })
		}
	}

	return content;
}

async function jumpToAnnotatedEvent(change){
	let found = null;
	for (let i = renderInfo.middlewareIndex + change; i >= 0 && i < renderInfo.request.events.length; i += change){
		if (!renderInfo.request.events[i].annotation) continue;
		found = i;
		break;
	}
	if (found === null) return false;
	while (renderInfo.middlewareIndex !== found) {
		await changeMiddleware(renderInfo.middlewareIndex + change);
		await new Promise(r => setTimeout(r, animationDuration / 5));
	}
	return true;
}

let annotationPlaying = false;

document.querySelector('#footer-prev-annotation').addEventListener('click', () => jumpToAnnotatedEvent(-1))
document.querySelector('#footer-pause-annotation').addEventListener('click', () => {
	allPlaying = false;
	annotationPlaying = false;
})
document.querySelector('#footer-play-annotation').addEventListener('click', async () => {
	if (annotationPlaying) return;
	annotationPlaying = true;
	await new Promise(r => setTimeout(r, animationDuration * 2))
	while (annotationPlaying){
		annotationPlaying = await jumpToAnnotatedEvent(1);
		const rawReadTime = renderInfo.request.events[renderInfo.middlewareIndex].annotation.split(' ').length / 200
		const readSeconds = Math.trunc(rawReadTime) * 60 + (rawReadTime % 1) * .60 * 100
		await new Promise(r => setTimeout(r, readSeconds * 1000))
	}
})
document.querySelector('#footer-next-annotation').addEventListener('click', () => jumpToAnnotatedEvent(1))

const editJSONButton = (getJSON, submitJSON) => ({
	innerHTML: 'Edit',
	onclick: () => openJSONEditorModal(getJSON, submitJSON)
})

async function renderMiddleware() {
	if (!renderInfo.request) return
	document.querySelector('#events').value = renderInfo.middlewareIndex;

	document.querySelector('#event-small').textContent = `${renderInfo.middlewareIndex + 1}/${renderInfo.request.events.length}`
	const event = renderInfo.request.events[renderInfo.middlewareIndex]
	const duration = event.start - renderInfo.request.id
	document.querySelector('meter').value = duration
	document.querySelector('#meter-wrapper').childNodes[0].nodeValue = (+duration.toFixed(0)).toLocaleString() + 'ms'
	document.querySelector('progress').value = renderInfo.middlewareIndex + 1
	document.querySelector('#progress-wrapper').childNodes[4].nodeValue = renderInfo.middlewareIndex + 1
	if (event.diffs) {
		for (const [i, key] of ['request', 'response'].entries()){
			if (!event.diffs[key]) {
				renderWindow(
					i + 1,
					{ title: key[0].toUpperCase() + key.slice(1), body: '' },
					editJSONButton(() => ({}), (_, newJSON) => {
						if (newJSON) event.diffs[key] = newJSON
						else delete event.diffs[key]
						renderMiddleware();
						updateEvent(renderInfo.request.id, event.start, { diffs: event.diffs })
					})
				);
				continue;
			}
			let original
			for (let i = 0; i <= renderInfo.middlewareIndex; i++){
				const delta = renderInfo.request.events[i].diffs?.[key];
				if (!delta) continue;

				if (!original) original = deserialize(serialize(delta));
				else try { jsondiffpatch.patch(original, deserialize(serialize(delta)))}
				catch(e) { console.error(e, original, delta, e) }
			}
			renderWindow(
				i + 1,
				{ title: key[0].toUpperCase() + key.slice(1), body: { type: 'diff', data: { original, delta: event.diffs[key] } } },
				editJSONButton(() => event.diffs[key], async (oldJSON, newJSON) => {
					if (document.querySelector('#jsonEditorUpdateSimilar').checked){
						const diffDiff = jsondiffpatch.diff(oldJSON, newJSON)
						const currentLabel = generateEventLabel(event, false)
						for (const otherRequest of Object.values(requests)){
							for (const otherEvent of otherRequest.events){
								if (generateEventLabel(otherEvent, false) === currentLabel){
									if (newJSON) jsondiffpatch.patch(otherEvent.diffs[key], diffDiff)
									else delete otherEvent.diffs[key]
									await updateEvent(otherRequest.id, otherEvent.start, { diffs: otherEvent.diffs })
								}
							}
						}
					}
					if (newJSON) event.diffs[key] = newJSON
					else delete event.diffs[key]
					await renderMiddleware();
					await updateEvent(renderInfo.request.id, event.start, { diffs: event.diffs })
				})
			);
		}
	} else if (event.type === 'redirect') {
		renderWindow(1, { body: '' })
		renderWindow(2, { title: 'Redirected', body: event.path })
	} else if (event.type === 'view') {
		renderWindow(1, { body: '' })
		renderWindow(
			2,
			{ title: event.name + ' view', body: { type: 'code', string: event.locals ? JSON.stringify(event.locals, undefined, '  ') : '{}' } },
			editJSONButton(() => event.locals, async (oldLocals, newLocals) => {
				if (document.querySelector('#jsonEditorUpdateSimilar').checked){
					const diffDiff = jsondiffpatch.diff(oldLocals, newLocals)
					const currentLabel = generateEventLabel(event, false)
					for (const otherRequest of Object.values(requests)){
						for (const otherEvent of otherRequest.events){
							if (generateEventLabel(otherEvent, false) === currentLabel){
								if (newLocals) jsondiffpatch.patch(otherEvent.locals, diffDiff)
								else delete otherEvent.locals
								await updateEvent(otherRequest.id, otherEvent.start, { locals: otherEvent.locals })
							}
						}
					}
				}
				if (newLocals) event.locals = newLocals
				else delete event.locals
				await renderMiddleware()
				await updateEvent(renderInfo.request.id, event.start, { locals: event.locals })
			})
		);
	} else if (event.type === 'send') {
		renderWindow(1, { body: '' })
		renderWindow(
			2,
			{ title: 'Response Body', body: { type: 'code', string: event.body } },
			{
				innerHTML: 'Edit',
				onclick: () => openTextModal(() => event.body || '', (_, newBody) => {
					event.body = newBody;
					renderMiddleware();
					updateEvent(renderInfo.request.id, event.start, { body: event.body })
				}, 'Set Body', 'Set')
			}
		);
	} else if (event.type === 'json') {
		renderWindow(1, { body: '' })
		renderWindow(
			2,
			{ title: 'Response JSON', body: { type: 'code', string: event.json ? JSON.stringify(event.json, undefined, '  ') : '' } },
			editJSONButton(() => event.json, async (oldJSON, newJSON) => {
				if (document.querySelector('#jsonEditorUpdateSimilar').checked){
					const diffDiff = jsondiffpatch.diff(oldJSON, newJSON)
					const currentLabel = generateEventLabel(event, false)
					for (const otherRequest of Object.values(requests)){
						for (const otherEvent of otherRequest.events){
							if (generateEventLabel(otherEvent, false) === currentLabel){
								if (newJSON) jsondiffpatch.patch(otherEvent.json, diffDiff)
								else delete otherEvent.json
								await updateEvent(otherRequest.id, otherEvent.start, { json: otherEvent.json })
							}
						}
					}
				}
				if (newJSON) event.json = newJSON
				else delete event.json
				await renderMiddleware()
				await updateEvent(renderInfo.request.id, event.start, { json: event.json })
			})
		);
	} else if (event.type === 'proxy-evaluate') {
		if (event.args?.string) renderWindow(1, { title: 'Arguments', body: { type: 'code', string: generateProxyCallLabel(event, event.args.string.slice(1, -1)) } },
		{
			innerHTML: 'Edit',
			onclick: () => openTextModal(() => event.args.string.slice(1, -1), (_, newArgsString) => {
				event.args.string = '[' + newArgsString + ']'
				renderMiddleware();
				updateEvent(renderInfo.request.id, event.start, { args: event.args })
			}, 'Set Arguments', 'Set')
		})
		else renderWindow(1, { body: '' })
		renderWindow(
			2,
			{ title: 'Result', body: { type: 'code', string: event.reason || event.value || '' } },
			event.reason || event.value ? {
				innerHTML: 'Edit',
				onclick: () => openTextModal(() => event.reason || event.value, (_, newThing) => {
					if (event.reason) event.reason = newThing;
					else event.value = newThing;
					updateEvent(renderInfo.request.id, event.start, { reason: event.reason, value: event.value })
					renderMiddleware();
				}, 'Set Result', 'Set')
			} : undefined
		);
	}
	renderWindow(7, {
		title: 'Annotation',
		body: { type: 'markdown', string: event.annotation || '' }
	},
		{
			innerHTML: 'Previous',
			onclick: () => jumpToAnnotatedEvent(-1)
		},
		{
			innerHTML: 'Edit',
			onclick: () => openTextModal(() => event.annotation || '# Markdown-Powered!', (_, newAnnotation) => {
				if (!newAnnotation) {
					if (event.annotation === undefined) return
					delete event.annotation
				} else {
					event.annotation = newAnnotation;
				}
				renderMiddleware();
				updateEvent(renderInfo.request.id, event.start, { annotation: newAnnotation });
			}, 'Set Annotation Markdown', 'Set')
		},
		{
			innerHTML: 'Edit All',
			onclick: () => openTextModal(() => renderInfo.request.events.map(event => `[//]: # (Start Event "${event.start}" aka "${generateEventLabel(event).trim()}")\n\n${event.annotation || ''}\n\n`).join('\n'), async (oldAnnotation, newAnnotation) => {
				if (!newAnnotation) {
					for (const event of renderInfo.request.events){
						if (!event.annotation) continue;
						delete event.annotation
						await updateEvent(renderInfo.request.id, event.start, { annotation: undefined });
					}
					delete event.annotation
				} else {
					const updated = new Set();
					for (const { start, content } of newAnnotation.split('[//]: # (Start Event "').slice(1).map(part => ({
						start: part.split('"')[0],
						content: part.split('")\n').slice(1).join('")\n').trim() || undefined
					}))) {
						const event = renderInfo.request.events.find(e => e.start == start)
						if (!event) {
							console.error(`Event not found for annotating: ${start}`)
							continue
						}
						updated.add(start);
						if (event.annotation === content) continue;
						await updateEvent(renderInfo.request.id, event.start, { annotation: content });
						event.annotation = content;
					}
					for (const start of oldAnnotation.split('[//]: # (Start Event "').slice(1).map(part => part.split('"')[0])) {
						if (updated.has(start)) continue;
						await updateEvent(renderInfo.request.id, event.start, { annotation: undefined });
						delete event.annotation
					}
				}
				await renderMiddleware();
			}, 'Set All Annotations', 'Set')
		},
		{
			innerHTML: 'Next',
			onclick: () => jumpToAnnotatedEvent(1)
		}
	);

	const urls = generateEventURLs(event)
	const remaining = [...(event.type === 'view' ? [viewInfo.views.directory + '/' + generateViewName(event.name)] : []), ...'added evaluated construct source error'.split` `.map(key => urls[key]).filter(Boolean).map(u => u.split('//').at(-1)).reverse()];
	if (!renderInfo.forward) remaining.reverse()

	const w5 = document.querySelector('#window5 pre')
	w5.innerHTML = generateEventCodeHTML(event, urls);
	attachRenderListeners(w5)

	const currentInAll = document.querySelector(`details[data-event-id="${event.start}"]`)
	if (currentInAll) {
		currentInAll.open = true;
		currentInAll.scrollIntoView({ behavior: 'smooth' });
		document.querySelectorAll('details.highlighted-event').forEach(e => e.classList.remove('highlighted-event'));
		currentInAll.classList.add('highlighted-event');
	}

	const remainingNodes = generateEventNodes(event, renderInfo.forward).reverse()

	if (!remainingNodes.length && renderInfo.lastNode) remainingNodes.push(renderInfo.lastNode)
	if (!remainingNodes.length) remainingNodes.push(cy.nodes()[0])

	disableButtons()
	await new Promise(r => setTimeout(r, animationDuration / 5));
	while (remainingNodes.length) {
		const target = remainingNodes.pop()

		let node = target
		if (node) renderInfo.lastNode = node;
		else node = renderInfo.lastNode;

		if (!node) continue;

		/*const nextReq = renderInfo.request.events[renderInfo.middlewareIndex + (renderInfo.forward ? 1 : -1)]
		if (nextReq) {
			const nextNodes = generateEventNodes(renderInfo.request.events[renderInfo.middlewareIndex + (renderInfo.forward ? 1 : -1)], renderInfo.forward);
			const otherNodeIDs = nextNodes.map(n => n.data('id'))
			const edgeIDs = new Set(otherNodeIDs.flatMap(id => [`${node.data('id')}-${id}`, `${id}-${node.data('id')}`]))
			node.connectedEdges().filter(e => edgeIDs.has(e.data('id'))).addClass('next-edge')
		}*/

		let ref = node.popperRef(); // used only for positioning
		// A dummy element must be passed as tippy only accepts dom element(s) as the target
		// https://atomiks.github.io/tippyjs/v6/constructor/#target-types

		if (!renderInfo.tip) {
			renderInfo.tip = addTippyContentUI(new tippy(document.querySelector('#tooltippy'), { // tippy props:
				getReferenceClientRect: ref.getBoundingClientRect, // https://atomiks.github.io/tippyjs/v6/all-props/#getreferenceclientrect
				trigger: 'manual', // mandatory, we cause the tippy to show programmatically.
				allowHTML: true,
				appendTo: document.body,
				interactive: true,
				placement: 'bottom',
				hideOnClick: false,
				duration: [0, 0],
				zIndex: 50,

				// your own custom props
				// content prop can be used when the target is a single element https://atomiks.github.io/tippyjs/v6/constructor/#prop
				content: generateEventTooltipContent.bind(null, event, urls)
			}))
		}
		else {
			function percentileDiff(a, b, percent) {
				return (b - a) * percent + a
			}
			const from = renderInfo.tip.props.getReferenceClientRect()
			const to = ref.getBoundingClientRect()
			if (JSON.stringify(from) !== JSON.stringify(to)) {
				const steps = animationDuration ? 50 : 1;
				for (let i = 1; i <= steps; i++) {
					setTimeout(() => {
						renderInfo.tip.setProps({
							getReferenceClientRect: () => {
								const updated = {};
								for (const key in from) {
									updated[key] = percentileDiff(from[key], to[key], i / steps)
								}
								return updated;
							}
						})
					}, i * (animationDuration / steps))
				}
			}

			renderInfo.tip.setContent(generateEventTooltipContent(event, urls))
			if (JSON.stringify(from) !== JSON.stringify(to)) await new Promise(r => setTimeout(r, animationDuration));
		}
		renderInfo.tip.show();
	}
	await new Promise(r => setTimeout(r, animationDuration / 5));
	enableButtons()
}

const requestSelect = document.querySelector('#requests');

function generateRequestLabel(request) {
	return request.label || (request.events[0].diffs.request.method + ' ' + request.events[0].diffs.request.url);
}

function renderRequestsSelect() {
	const selected = requestSelect.value;
	requestSelect.innerHTML = '';
	requestSelect.appendChild(Object.entries(requests).reduce((frag, [value, request], i) => {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = generateRequestLabel(request)
		if (!i && !selected) option.selected = true;
		else if (selected == option.value) option.selected = true;

		frag.appendChild(option)
		return frag;
	}, document.createDocumentFragment()))
}
renderRequestsSelect()

function deleteRequest(id){
	const request = requests[id];
	const index = Object.values(requests).findIndex(r => r.id === request.id)
	delete requests[request.id]
	if (renderInfo.request.id === id) renderInfo.request = Object.values(requests)[index] || Object.values(requests)[index - 1] || Object.values(requests)[0];
	if (requestSelect.value == id) requestSelect.value = renderInfo.request.id;
	renderRequestsSelect()
	renderMiddlewaresSelect()
	renderRequest()
	renderMiddleware()
	API.deleteRequest(request.id)
}

document.querySelector('#delete-request').addEventListener('click', () => {
	if (renderInfo.request) deleteRequest(renderInfo.request.id);
})

document.querySelector('#delete-event').addEventListener('click', () => {
	const request = renderInfo.request;
	const event = request.events[renderInfo.middlewareIndex]
	request.events.splice(renderInfo.middlewareIndex, 1)
	renderInfo.middlewareIndex = Math.max(0, renderInfo.middlewareIndex - 1)
	document.querySelector('#events').value = request.events[renderInfo.middlewareIndex].start
	renderMiddlewaresSelect()
	renderMiddleware()
	return API.deleteEvent(request.id, event.start)
})


async function changeMiddleware(nth) {
	if (renderInfo.animating) return false
	let oldNth = renderInfo.middlewareIndex;
	renderInfo.middlewareIndex = nth;
	renderInfo.forward = renderInfo.middlewareIndex > oldNth;
	await renderMiddleware();

	document.querySelector('#events').selectedOptions[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	return true;
}

document.querySelector('#events').addEventListener('change', e => {
	changeMiddleware(+e.currentTarget.value)
})

function renderMiddlewaresSelect() {

	const eventsSelector = document.querySelector('#events')
	const selected = eventsSelector.value;
	eventsSelector.innerHTML = '';
	if (!renderInfo.request) return;
	const ends = []
	eventsSelector.appendChild(renderInfo.request.events.reduce((frag, e, i) => {
		const endingAfterMe = ends.filter(end => end > e.start).length
		ends.push(e.end)
		const option = document.createElement('option')
		option.value = i;
		option.textContent = '-'.repeat(endingAfterMe) + generateEventLabel(e);
		frag.appendChild(option)
		if (selected == option.value) option.selected = true;
		return frag
	}, document.createDocumentFragment()));
	eventsSelector.size = eventsSelector.children.length

	document.querySelector('#event-small').textContent = `${renderInfo.middlewareIndex + 1}/${renderInfo.request.events.length}`
	const duration = renderInfo.request.events.at(-1).end - renderInfo.request.id;
	document.querySelector('#meter-wrapper').childNodes[2].nodeValue = (+duration.toFixed(0)).toLocaleString() + 'ms'
	document.querySelector('meter').value = 0;
	document.querySelector('meter').max = duration;

	document.querySelector('#progress-wrapper').childNodes[6].nodeValue = renderInfo.request.events.length
	document.querySelector('progress').max = renderInfo.request.events.length;
}

function attachRenderListeners(parent) {
	document.querySelectorAll('details').forEach(d => d.querySelector('button').addEventListener('click', () =>
		changeMiddleware(renderInfo.request.events.findIndex(e => e.start == d.dataset.eventId))
	))
}

function extractRanges(numbers) {
	if (!numbers.length) return '';

	let ranges = [];
	let start = numbers[0];

	function addCurrentRange(last) {
		const rangeLength = last - start;
		if (rangeLength < 2) {
			ranges.push(...Array.from({ length: rangeLength + 1 }, (_, i) => (i + start).toString()));
		} else {
			ranges.push(`${start}-${last}`);
		}
	}

	for (let i = 1; i < numbers.length; i++) {
		const current = numbers[i];
		const last = numbers[i - 1];

		if (current - last !== 1) {
			addCurrentRange(last);
			start = current;
		}
	}
	addCurrentRange(numbers[numbers.length - 1]);

	return ranges.join(',');
}

const PLACEMENTS = [
	'top-start',
	'top-end',
	'right',
	'right-start',
	'right-end',
	'bottom',
	'bottom-start',
	'bottom-end',
	'left',
	'left-start',
	'left-end',
]


function addTippyContentUI(tip){
	const content = document.createElement('div');

	const close = document.createElement('button');
	close.classList = 'close-tippy'
	close.textContent = 'x'
	close.addEventListener('click', () => tip.hide())
	content.appendChild(close)

	const placementToggle = document.createElement('button');
	placementToggle.classList = 'cycle-placement'
	placementToggle.textContent = '↻'
	placementToggle.addEventListener('click', () => {
		const placement = PLACEMENTS[(PLACEMENTS.indexOf(tip.props.placement) + 1) % PLACEMENTS.length];
		tip.setProps({ placement })
		console.log(tip.props.placement, placement)
		tip.setProps({ getReferenceClientRect: cy.$(`[id="${tip.r2NodeId}"]`).popperRef().getBoundingClientRect })
	})
	content.appendChild(placementToggle)

	content.appendChild(tip.props.content)

	tip.setContent(content)

	const setContent = tip.setContent;
	tip.setContent = newContent => {
		content.innerHTML = '';
		content.appendChild(close)
		content.appendChild(placementToggle)
		content.appendChild(newContent)
		return setContent.call(tip, content)
	}
	return tip;
}

const codeTooltipTippys = [];

function renderCodeTooltips() {
	codeTooltipTippys.forEach(tip => tip.hide())
	codeTooltipTippys.splice(0, codeTooltipTippys.length);

	if (!codeTooltips) return

	const nodeInfos = {}

	const elements = Object.values(cy.elements()).map(cye => {
		if (typeof cye?.data === 'function') return { data: cye.data() }
		else return { data: {} }
	})

	let i = 0;

	for (const [ei, e] of renderInfo.request?.events.entries() || []) {
		const label = generateEventLabel(e);
		const urls = generateEventURLs(e)
		const allCodes = generateHighlightedCode(e)
		for (const o of allCodes) {
			o.i = i++;
			o.label = label;
			o.url = urls[o.key]
			const node = sourceLineToID(elements, o.url.split('//').at(-1))
			if (!node) {
				console.log('MISSING', o.url)
			} else {
				if (!(node.data.id in nodeInfos)) nodeInfos[node.data.id] = {
					i: ei, infos: []
				}
				nodeInfos[node.data.id].infos.push(o)
			}
		}
	}

	for (const [nid, { i, infos }] of Object.entries(nodeInfos)){
		const node = cy.$(`[id="${nid}"]`)
		let ref = node.popperRef();
		const tip = new tippy(document.querySelector('#tooltippy'), { // tippy props:
			getReferenceClientRect: ref.getBoundingClientRect, // https://atomiks.github.io/tippyjs/v6/all-props/#getreferenceclientrect
			trigger: 'manual', // mandatory, we cause the tippy to show programmatically.
			allowHTML: true,
			appendTo: document.body,
			interactive: true,
			placement: 'auto',
			hideOnClick: false,
			duration: [0, 0],
			zIndex: 10 + i,

			// your own custom props
			// content prop can be used when the target is a single element https://atomiks.github.io/tippyjs/v6/constructor/#prop
			content: () => {
				let content = document.createElement('pre');
				content.innerHTML = infos.map(info => `<a href="${info.url}">#${info.i} - ${info.label}</a>` + info.html).join('<br/>')
				return content;
			}
		})
		tip.r2NodeId = nid
		tip.show()
		codeTooltipTippys.push(addTippyContentUI(tip))
	}
}

function renderRequestPath() {
	cy.edges('.request-edge').removeClass('request-edge').data('label', '').data('order', []);
	cy.nodes('.request-node').removeClass('request-node').data('order', []).forEach(n => n.data('label', n.data('baseLabel') || n.data('label')));

	const nodeIDs = [];
	const nodeIndexes = [];
	const edgeIDs = [];
	const edgeIndexes = [];
	for (const [i, event] of renderInfo.request.events.entries()) {
		const nextEvent = renderInfo.request.events[i + 1]
		if (!nextEvent) continue;
		for (const from of generateEventNodes(event, true).map(node => node.data('id'))) {
			nodeIDs.push(from);
			nodeIndexes.push(i + 1);
			for (const to of generateEventNodes(nextEvent, true).map(node => node.data('id'))) {
				if (from === to) continue;
				edgeIDs.push(`${from}-${to}`);
				edgeIndexes.push(i + 2);
				edgeIDs.push(`${to}-${from}`);
				edgeIndexes.push(i + 2);
				nodeIDs.push(to);
				nodeIndexes.push(i + 2);
			}
		}
	}
	cy.filter(e => edgeIDs.includes(e.data('id'))).addClass('request-edge').data('label', '').data('order', []);
	cy.filter(n => nodeIDs.includes(n.data('id'))).addClass('request-node').data('order', []).forEach(n => n.data('label', n.data('baseLabel') || n.data('label')));

	const indexing = {}
	if (eventNumbers) {
		for (const [i, edgeID] of [...edgeIDs].entries()) {
			const edge = cy.$(`[id="${edgeID}"]`)
			if (!edge.length) continue
			edge.data('order', [...(edge.data('order') || []), edgeIndexes[i]]);
			indexing[edgeID] = edge;
		}
		for (const [i, nodeID] of [...nodeIDs].entries()) {
			const node = cy.$(`[id="${nodeID}"]`)
			if (!node.length) continue

			node.data('order', [...(node.data('order') || []), nodeIndexes[i]]);
			indexing[nodeID] = node;
		}
		for (const entity of Object.values(indexing)) {
			const oldLabel = entity.data('label');
			const nums = extractRanges(entity.data('order').filter((o, i, arr) => arr.indexOf(o) === i))
			if (oldLabel) entity.data('label', oldLabel + '\n' + nums)
			else entity.data('label', nums)
		}
	}


	cy.edges('.hidden').removeClass('hidden');
	if (!allNodes || !allEdges) {
		cy.edges('*').not('.request-edge').addClass('hidden')
		cy.edges('.request-edge').removeClass('request-edge');
	}
	cy.nodes('.hidden').removeClass('hidden');
	if (!allNodes) {
		for (const id of nodeIDs) {
			cy.$(`[id="${id}"]`).ancestors().addClass('request-node')
		}
		cy.nodes('*').not('.request-node').addClass('hidden')
		cy.nodes('.request-node').removeClass('request-node');
	}
	if (!eventHighlights){
		cy.nodes('.request-node').removeClass('request-node');
		cy.edges('.request-edge').removeClass('request-edge');
	}
}
function renderRequest() {
	renderInfo.middlewareIndex = 0;
	renderWindow(1, { body: '' })
	renderWindow(2, { body: '' })
	renderWindow(5, { body: '' })
	renderWindow(6, { body: '' })
	renderWindow(7, { body: '' })
	renderMiddleware();
	renderBubbles()
	renderMiddlewaresSelect()
	renderCodeTooltips()
	if (!renderInfo.request) return

	const w6 = document.querySelector('#window6 pre')
	w6.innerHTML = '';
	let lastHTML = ''
	for (const [i, e] of renderInfo.request.events.entries()) {
		let nextHTML = generateEventCodeHTML(e);
		if (nextHTML === lastHTML || lastHTML.includes(nextHTML)) nextHTML = 'SAME'
		if (nextHTML !== 'SAME') lastHTML = nextHTML
		w6.innerHTML += `<details open data-event-id="${e.start}"><summary>${generateEventLabel(e)} <button>Render</button></summary>${nextHTML === 'SAME' ? i ? 'Same as previous' : '' : nextHTML}</details>`
	}
	attachRenderListeners(w6)
	renderRequestPath()
}
requestSelect.addEventListener('change', (e) => {
	renderInfo.request = requests[e.currentTarget.value]
	renderRequest()
})

function enableButtons() {
	renderInfo.animating = false;
	document.querySelectorAll('input, textarea, button:not(#connection-indicator), select').forEach(b => b.disabled = false)
}
function disableButtons() {
	renderInfo.animating = true;
	document.querySelectorAll('input, textarea, button:not([id^="footer-pause"], #connection-indicator), select').forEach(b => b.disabled = true)
}

renderRequest()

document.querySelector('#reset-all').addEventListener('click', () => {
	if (!confirm('Clearing all local settings, are you sure?')) return
	localStorage.clear()
	alert('All local settings cleared')
	window.location.reload()
});

window.addEventListener('keydown', ({ target, key }) => {
	if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
	switch (key) {
		case 'ArrowLeft':
		case 'ArrowRight':
			changeMiddleware(Math.min(Math.max(renderInfo.middlewareIndex + (key === 'ArrowLeft' ? -1 : 1), 0), renderInfo.request.events.length - 1));
			break
	}
});
let eventPlaying = false;
document.querySelector('#footer-pause-event').addEventListener('click', () => {
	allPlaying = false;
	eventPlaying = false;
})

async function playHandlers(){
	eventPlaying = true;
	await new Promise(r => setTimeout(r, animationDuration * 2))
	while (eventPlaying){
		let nextNth = Math.min(Math.max(renderInfo.middlewareIndex + 1, 0), renderInfo.request.events.length - 1)
		if (nextNth === renderInfo.middlewareIndex) eventPlaying = false;
		else {
			await changeMiddleware(nextNth);

			const rawReadTime = (renderInfo.request.events[renderInfo.middlewareIndex].annotation?.split(' ').length || 0) / 200
			const readSeconds = Math.trunc(rawReadTime) * 60 + (rawReadTime % 1) * .60 * 100
			await new Promise(r => setTimeout(r, (readSeconds * 1000) || animationDuration))
		}
	}
}
document.querySelector('#footer-play-event').addEventListener('click', () => {
	if (!eventPlaying) playHandlers()
})
document.querySelector('#footer-prev-event').addEventListener('click', () => changeMiddleware(Math.min(Math.max(renderInfo.middlewareIndex - 1, 0), renderInfo.request.events.length - 1)))

document.querySelector('#footer-next-event').addEventListener('click', () => changeMiddleware(Math.min(Math.max(renderInfo.middlewareIndex + 1, 0), renderInfo.request.events.length - 1)))

let allPlaying = false;
document.querySelector('#play-requests').addEventListener('click', async () => {
	allPlaying = true
	for (let requestIndex = Object.keys(requests).indexOf('' + renderInfo.request.id); allPlaying && Object.values(requests)[requestIndex]; requestIndex++) {
		renderInfo.request = Object.values(requests)[requestIndex];
		renderRequest()
		await new Promise(r => setTimeout(r, animationDuration * 2))
		requestSelect.scrollIntoView({ behavior: 'smooth', block: 'start' })
		await new Promise(r => setTimeout(r, animationDuration * 2))
		await playHandlers()
		await new Promise(r => setTimeout(r, animationDuration * 2))
	}
})

function updateRequestInfo(request, updates){
	return API.updateRequest(request.id, updates)
}

function updateEvent(requestId, eventStart, updates) {
	return API.updateEvent(requestId, eventStart, updates)
}

function downloadBlob(blob, filename){
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.style.display = 'none';
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	URL.revokeObjectURL(url);
	anchor.remove();
}

document.querySelector('#save-as-png').addEventListener('click', () => {
	window.open(cy.png({
		bg: document.querySelector('#transparentBackground').checked
			? 'transparent'
			: document.querySelector('#darkTheme').checked
				? '#41403e'
				: 'white',
		full: true
	}), '_blank')
});

document.querySelector('#save-as-svg').addEventListener('click', () => {
	const svgWindow = window.open("", 'SVG', '_blank')
	const rawSVG = cy.svg({
		bg: document.querySelector('#transparentBackground').checked
			? 'transparent'
			: document.querySelector('#darkTheme').checked
				? '#41403e'
				: 'white',
		full: true
	})
	svgWindow.document.body.innerHTML = rawSVG;
	svgWindow.document.body.innerHTML = generateLinkedSVG(svgWindow.document.body.children[0], document.querySelector('#root-input').value || viewInfo.root);

	const linkedSVG = svgWindow.document.body.innerHTML;

	const downloadBtn = document.createElement('button');
	downloadBtn.textContent = 'Download';
	downloadBtn.addEventListener('click', () => downloadBlob(new Blob([linkedSVG], { type: 'image/svg+xml' }), 'graph.svg'))
	svgWindow.document.body.appendChild(downloadBtn);
});

const openTextModal = (() => {
	const checkbox = document.querySelector('#modal-3');
	const modal = checkbox.nextElementSibling;

	const info = {};

	const openTextModal = (getText, submitText, title, button) => {
		Object.assign(info, { getText, submitText })
		modal.elements[0].value = getText()
		modal.querySelector('.modal-title').textContent = title;
		modal.querySelector('button').textContent = button;
		checkbox.checked = true;
		modal.elements[0].focus()
	}

	modal.addEventListener('submit', e => {
		e.preventDefault()

		info.submitText(info.getText(), modal.elements[0].value)
		checkbox.checked = false;
	})

	return openTextModal;
})();

const openJSONEditorModal = (() => {
	const checkbox = document.querySelector('#modal-4');
	const modal = checkbox.nextElementSibling;

	const editor = new JSONEditor(modal.querySelector('#jsoneditor'), {
		mode: 'code'
	});

	const info = {};

	const openJSONEditorModal = (getInitialJSON, submitJSON) => {
		Object.assign(info, { getInitialJSON, submitJSON })
		editor.set(getInitialJSON())
		checkbox.checked = true;
		modal.querySelector('#jsonEditorUpdateSimilar').checked = false
	}

	modal.addEventListener('submit', e => {
		e.preventDefault()

		try {
			info.submitJSON(info.getInitialJSON(), editor.get());
			checkbox.checked = false;
		} catch(e) {
			console.error(e)
			if (!editor.getText() && confirm('Delete JSON entirely?')) {
				info.submitJSON(info.getInitialJSON(), null);
				checkbox.checked = false;
			}
		}
	})

	return openJSONEditorModal;
})();

(() => {
	const checkbox = document.querySelector('#modal-1');
	const modal = checkbox.nextElementSibling;
	modal.addEventListener('submit', e => {
		e.preventDefault();
		const name = modal.querySelector('#export-data-input').value
		localStorage.setItem(`saved-data-${name}`, JSON.stringify(serialize(getData(), { json: true })))
		checkbox.checked = false;
	})

	document.querySelector('#copy-data').addEventListener('click', () => {
		navigator.clipboard.writeText(JSON.stringify(serialize(getData(), { json: true }))).then(() => alert('Data copied to clipboard!'));
	});


	document.querySelector('#download-data').addEventListener('click', () => {
		downloadBlob(new Blob([JSON.stringify(serialize(getData(), { json: true }))], { type: 'application/json' }), 'data.json');
	});

	const uploadBtn = document.querySelector('#upload-export-button')
	if (!selfId) uploadBtn.disabled = true;
	else uploadBtn.addEventListener('click', () => {
		upsertData(getData()).then(() => checkbox.checked = false)
	})

	document.querySelector('#all-button').addEventListener('click', () => {
		const checkboxes = [...modal.querySelectorAll('ul input[type="checkbox"]')]
		const newValue = !checkboxes.every(c => c.checked)
		for (const checkbox of checkboxes) {
			checkbox.checked = newValue;
		}
	});

	document.querySelector('#invert-button').addEventListener('click', () => {
		for (const checkbox of modal.querySelectorAll('ul input[type="checkbox"]')) {
			checkbox.checked = !checkbox.checked;
		}
	});

	function getData() {
		const data = {
			external: {
				slug: document.querySelector('#slug-export-input').value,
				owner: document.querySelector('#owner-export-input').value,
				repository: document.querySelector('#repository-export-input').value,
				authorId: selfId
			},
			version: viewInfo.VERSION,
			paths: {
				root: document.querySelector('#root-input').value,
				views: {
					directory: document.querySelector('#views-directory-input').value,
					extension: document.querySelector('#views-extension-input').value,
				}
			}
		}
		if (modal.querySelector('#layout-windows-checkbox').checked) data.windows = Array.from({ length: 7 }, (_, i) => localStorage.getItem('window' + (i + 1) + '-style'))
		if (modal.querySelector('#layout-graph-checkbox').checked) data.graph = {
			modules: viewInfo.modules,
			positions: cy.nodes().reduce((locs, n) => ({ ...locs, [n.id()]: n.position() }), {}),
			zoom: cy.zoom(),
			pan: cy.pan()
		}
		if (modal.querySelector('#layout-style-rules').checked) {
			data.styleRules = JSON.parse(localStorage.getItem('style-rules') || '{}');
			data.layoutValues = {
				'layout-options': document.querySelector('#layout-options').value,
				'animation-duration': document.querySelector('#animation-duration').value,
				allEdges: document.querySelector('#allEdges').checked,
				eventNumbers: document.querySelector('#eventNumbers').checked,
				allNodes: document.querySelector('#allNodes').checked,
				darkTheme: document.querySelector('#darkTheme').checked,
				eventHighlights: document.querySelector('#eventHighlights').checked,
				codeTooltips: document.querySelector('#codeTooltips').checked,
			}
		}
		const selectedRequests = Object.fromEntries([...modal.querySelectorAll('ul input[type="checkbox"]:checked')].map(checkbox => {
			const id = checkbox.id.split('-')[0];
			return [id, requests[id]];
		}))
		if (Object.keys(selectedRequests).length) data.requests = selectedRequests;
		return data
	}

	function renderRequestsUL(){
		modal.querySelector('ul').innerHTML = '';
		modal.querySelector('ul').appendChild(Object.entries(requests).reduce((frag, [id, request]) => {
			const li = document.createElement('li');
			li.innerHTML = `
				<label for="${id}-request" class="paper-check" style="display: flex;">
					<input type="checkbox" name="paperChecks" id="${id}-request" value="option 2">
					<span style="flex: 1;">${generateRequestLabel(request)}</span>
					<button style="float: right;" type="button">Rename</button>
					<button style="float: right;" type="button">Delete</button>
				</label>
			`;
			const [renameButton, deleteButton] = li.querySelectorAll('button')
			renameButton.addEventListener('click', () => {
				const { request } = renderInfo;
				const newLabel = prompt('New Request Name', generateRequestLabel(request))
				if (!newLabel) return;
				if (newLabel === generateRequestLabel(request)){
					if (request.label) delete request.label
					else return
				}
				request.label = newLabel;
				updateRequestInfo(request, { label: newLabel })
				renderRequestsSelect();
				renderRequestsUL()
			})
			deleteButton.addEventListener('click', () => {
				deleteRequest(id)
				li.remove()
			})

			frag.appendChild(li);
			return frag;
		}, document.createDocumentFragment()));
	}

	document.querySelector('#export-data-button').addEventListener('click', () => {
		checkbox.checked = true;
		document.querySelector('#button3').click()

		modal.reset()


		document.querySelector('#root-input').value = viewInfo.root;
		document.querySelector('#views-directory-input').value = viewInfo.views.directory;
		document.querySelector('#views-extension-input').value = viewInfo.views.extension;

		const datalist = document.querySelector('#export-data-datalist')
		datalist.innerHTML = '';
		datalist.appendChild(Object.keys(localStorage).reduce((frag, key) => {
			if (!key.startsWith('saved-data-')) return frag;
			const name = key.split('saved-data-')[1];
			const option = document.createElement('option');
			option.textContent = name;
			frag.appendChild(option);
			return frag;
		}, document.createDocumentFragment()));

		renderRequestsUL()
	});
})();


(() => {
	const checkbox = document.querySelector('#modal-2');
	const modal = checkbox.nextElementSibling;
	modal.addEventListener('submit', async (e) => {
		e.preventDefault()

		let text;
		const inputs = ['import-data-file', 'import-data-text', 'import-data-select'].map(name => modal.querySelector('#' + name, e))
		if (inputs[0].files[0]) {
			text = await new Promise(resolve => {
				const reader = new FileReader();
				reader.onload = (e) => resolve(e.target.result);
				reader.readAsText(inputs[0].files[0])
			})
		}
		if (inputs[1].value) text = inputs[1].value;
		if (inputs[2].value) text = localStorage.getItem('saved-requests-' + localName);

		importData(deserialize(JSON.parse(text)), cy)
		renderInitialWindows();
		renderRequestsSelect();
		renderMiddlewaresSelect();
		renderRequest();
		renderStyleRules();
		updateStyles();
		checkbox.checked = false;
	})

	const select = document.querySelector('#import-data-select')
	select.innerHTML = '';
	select.appendChild(Object.keys(localStorage).reduce((frag, key) => {
		if (!key.startsWith('saved-data-')) return frag;
		const name = key.split('saved-data-')[1];
		const option = document.createElement('option');
		option.textContent = name;
		frag.appendChild(option);
		return frag;
	}, document.createDocumentFragment()));

	document.querySelector('#import-data-button').addEventListener('click', () => {
		checkbox.checked = true;

		modal.reset()
	});
})();
