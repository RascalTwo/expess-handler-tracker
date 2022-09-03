import LAYOUTS from './layouts.js'

let animationDuration = 1000;
(() => {
	const range = document.querySelector('#animation-duration')
	range.addEventListener('change', () => {
		animationDuration = +range.value
	})
	animationDuration = range.value;
})();

const DEFAULT_STYLE_RULES = {
	'default-rule': {
		pattern: '.*',
		color: '#729fcf',
		shape: 'ellipse'
	},
	'model-rule': {
		pattern: 'mod(e|a)l',
		color: '#ff0000',
		shape: 'barrel'
	},
	'view-rule': {
		pattern: 'view',
		color: '#0000ff',
		shape: 'vee'
	},
	'controller-rule': {
		pattern: 'controll?er',
		color: '#00ff00',
		shape: 'rhomboid'
	},
	'router-rule': {
		pattern: 'route',
		color: '#ffff00',
		shape: 'concave-hexagon'
	}
}

if (!localStorage.getItem('style-rules')) localStorage.setItem('style-rules', JSON.stringify(DEFAULT_STYLE_RULES))

function generateStyleRuleHTML(pattern, color, shape, isDefault = false) {
	return `
		<td><input placeholder="Regex" value="${pattern}" ${isDefault ? 'readonly' : ''} /></td>
		<td><input type="color" value="${color}" /></td>
		<td>
			<select>
				${[
			['', 'Default'],
			['ellipse', 'Ellipse'],
			['triangle', 'Triangle'],
			['round-triangle', 'Round Triangle'],
			['rectangle', 'Rectangle'],
			['round-rectangle', 'Round Rectangle'],
			['bottom-round-rectangle', 'Bottom Round Rectangle'],
			['cut-rectangle', 'Cut Rectangle'],
			['barrel', 'Barrel'],
			['rhomboid', 'Rhomboid'],
			['diamond', 'Diamond'],
			['round-diamond', 'Round Diamond'],
			['pentagon', 'Pentagon'],
			['round-pentagon', 'Round Pentagon'],
			['hexagon', 'Hexagon'],
			['round-hexagon', 'Round Hexagon'],
			['concave-hexagon', 'Concave Hexagon'],
			['heptagon', 'Heptagon'],
			['round-heptagon', 'Round Heptagon'],
			['octagon', 'Octagon'],
			['round-octagon', 'Round Octagon'],
			['star', 'Star'],
			['tag', 'Tag'],
			['round-tag', 'Round Tag'],
			['vee', 'Vee'],
		].map(([value, text]) => `<option value="${value}" ${shape === value ? 'selected' : ''}>${text}</option>`).join('\n')}
			</select>
		</td>
		<td>
			<button>Reset</button>
			${!isDefault ? '<button class="btn-danger">Delete</button>' : ''}
		</td>
	`
}

function hookupStyleRuleListeners(row, pattern, color, shape) {
	const [patternInput, colorInput, shapeSelect] = row.querySelectorAll('input, select');
	[patternInput, colorInput, shapeSelect].forEach(e => e.addEventListener('change', updateStyles))
	row.querySelector('button').addEventListener('click', () => {
		patternInput.value = pattern;
		colorInput.value = color;
		shapeSelect.value = shape;
		updateStyles();
	})
	row.querySelector('button.btn-danger')?.addEventListener('click', () => {
		cy.nodes('.' + row.dataset.class).removeClass(row.dataset.class);
		row.remove();
		updateStyles();
	});
}

function renderStyleRules() {
	for (const [className, { pattern, color, shape }] of Object.entries(JSON.parse(localStorage.getItem('style-rules') || '{}'))) {
		const isDefault = className === 'default-rule'
		const row = document.querySelector(`tr[data-class="${className}"]`) || document.createElement('tr');
		row.dataset.class = className;
		row.innerHTML = generateStyleRuleHTML(pattern, color, shape, isDefault)
		hookupStyleRuleListeners(row, pattern, color, shape)

		if (!document.contains(row)) document.querySelector('.style-rules-wrapper tbody').appendChild(row);
	}
}
renderStyleRules()

document.querySelector('#add-rule').addEventListener('click', () => {
	const row = document.createElement('tr');
	row.dataset.class = Date.now() + '-rule';
	row.innerHTML = generateStyleRuleHTML('', '', '');
	hookupStyleRuleListeners(row, '', '', '');
	document.querySelector('.style-rules-wrapper tbody').appendChild(row);
})



document.querySelector('#reset-rules').addEventListener('click', () => {
	document.querySelector('.style-rules-wrapper tbody').innerHTML = '';
	localStorage.setItem('style-rules', JSON.stringify(DEFAULT_STYLE_RULES));
	renderStyleRules();
})

function parseStyleRules() {
	return [...document.querySelectorAll('.style-rules-wrapper tbody > tr')].map(row => ({
		class: row.dataset.class,
		pattern: row.querySelector('input').value,
		color: row.querySelector('input[type="color"]').value,
		shape: row.querySelector('select').value,
	}));
}

function updateStyles() {
	const styleRules = parseStyleRules()
	localStorage.setItem('style-rules', JSON.stringify(styleRules.reduce((obj, { class: className, ...rule }) => ({ ...obj, [className]: rule }), {})));
	cy.style(generateStylesheet(styleRules));
}

function generateStylesheet(styleRules = parseStyleRules()) {
	if (window.cy?.styles) {
		const oldStyles = window.cy.styles()
		for (let i = 0; i < oldStyles.length; i++) {
			const rule = oldStyles[i];
			if (!rule.selector.endsWith('-rule')) continue
			cy.nodes(rule.selector).removeClass(rule.selector);
		}
	}

	window.cy?.nodes().forEach(node => {
		for (const rule of styleRules) {
			try {
				if ([node.data('id'), ...node.classes()].some(string => string.match(new RegExp(rule.pattern, 'i')))) {
					node.addClass(rule.class)
				}
			} catch (_) { }
		}
	})
	return [
		{
			selector: 'node',
			style: {
				label: 'data(label)',
				'border-style': 'solid',
				'border-width': '1px',
				'border-color': 'black',
				"text-outline-color": "#fff",
				"text-outline-width": 1,
			}
		}, {
			"selector": ".group",
			"style": {
				"color": e => e.style('background-color'),
				"text-outline-color": "#fff",
				"text-outline-width": 1,
				'background-opacity': 0.25,
			}
		}, {
			selector: "edge",
			css: {
				"line-fill": "linear-gradient",
				"line-gradient-stop-colors": e => e.source().style('background-color') + ' ' + e.target().style('background-color')
				,
				"line-gradient-stop-positions": "25 75",
				'target-arrow-shape': 'triangle',
				'target-arrow-color': e => e.target().style('background-color'),
				"curve-style": "straight",
				'underlay-color': 'black',
				'underlay-opacity': 1,
				'underlay-padding': '2',
				'underlay-shape': 'rectangle',
			}
		}, {
			selector: '.hidden',
			css: {
				display: 'none'
			}
		}, {
			selector: ".request-edge",
			css: {
				'overlay-color': 'black',
				'overlay-opacity': 1,
				'overlay-padding': '0.5',
				'overlay-shape': 'round-rectangle',
			}
		}, ...styleRules.map(({ class: className, color, shape }) => ({
			"selector": '.' + className,
			"style": {
				"background-color": color || 'inherit',
				shape: shape || 'inherit'
			}
		}))]
}

let compoundNodes = document.querySelector('#groups').checked
let allEdges = document.querySelector('#allEdges').checked;
let darkTheme = document.querySelector('#darkTheme').checked;
document.querySelector('html').classList.toggle('dark', darkTheme);


let requests = await fetch('../requests').then(r => r.text()).then(raw => Flatted.parse(raw));
let { modules, root, viewsDirectory } = await fetch('../info').then(r => r.json());

let fails = 1;
const connectionIndicator = document.querySelector('#connection-indicator');
function setupEventSource() {
	const es = new EventSource('../events');
	connectionIndicator.dataset.readyState = es.readyState
	es.addEventListener('open', () => {
		connectionIndicator.dataset.readyState = es.readyState
		fails = 0;
	})
	es.addEventListener('message', event => {
		fails = 0;
		const newRequests = Flatted.parse(event.data);
		for (const [id, request] of Object.entries(newRequests)) {
			if (!(id in requests)) {
				requests[id] = request;
				continue;
			}
			for (const event of request.events) {
				requests[id].events.push(event)
			}

			requests[id].events.sort((a, b) => a.start - b.start || a.order - b.order);
		}
		if (!currentRequest) currentRequest = Object.values(requests)[0]
		renderRequestsSelect();
		renderMiddlewaresSelect();
	});

	es.addEventListener('error', err => {
		fails++;
		connectionIndicator.dataset.readyState = es.readyState;
		console.error(err);
		if (es.readyState === 2) {
			es.close()
			setTimeout(() => setupEventSource(), 5000 * fails);
		}
	});
}
setupEventSource();

function toggleTheme() {
	document.querySelector('html').classList.toggle('dark', darkTheme);
}

function sourceLineToID(objects, fullSrc) {
	let src = fullSrc.split(':')[0]
	while (src.includes('/')) {
		if (objects.find(e => e.data.id === src)) break;
		src = src.split('/').slice(1).join('/')
	}
	return objects.find(e => e.data.id === src)
}

function generateElements() {
	const parents = {};
	const elements = modules.map(mod => {
		const parent = compoundNodes && mod.source.split('/').at(-2)
		if (parent && !(parent in parents)) parents[parent] = { data: { id: parent, label: parent }, classes: 'group parent-' + parent }
		return {
			data: { id: mod.source, parent, label: mod.source.split('/').at(-1), href: `vscode://file${root}${mod.source}` },
			classes: parent ? 'parent-' + parent : undefined
		}
	})
	for (const mod of modules) {
		for (const dep of mod.dependencies) {
			elements.push({
				data: {
					id: `${mod.source}-${dep}`,
					source: mod.source,
					target: dep,
					arrow: 'triangle',
				}
			})
		}
	}
	const views = {}
	for (const req of Object.values(requests)) {
		for (const event of req.events) {
			if (event.type === 'view') {
				const caller = sourceLineToID(elements, event.evaluate.lines[0])
				const id = viewsDirectory + '/' + event.name
				views[event.name] = {
					data: { id, label: event.name, parent: compoundNodes && viewsDirectory },
					classes: 'parent-' + viewsDirectory
				}
				if (caller) {
					elements.push({ data: { id: `${caller.data.id}-${id}`, source: caller.data.id, target: id, arrow: 'triangle' }, classes: 'group' })
				}
			}
		}
	}
	if (Object.values(views)) {
		elements.push(...Object.values(views))
		if (compoundNodes) elements.push({ data: { id: viewsDirectory, label: viewsDirectory }, classes: `parent-${viewsDirectory} group` })
	}
	elements.push(...Object.values(parents))
	return elements;
}



window.cy = cytoscape({
	container: document.getElementById('cy-div'),
	elements: generateElements(),
	layout: Object.values(LAYOUTS)[0],
	wheelSensitivity: 0.05
});
window.cy.style(generateStylesheet())
document.querySelector('#groups').addEventListener('change', e => {
	compoundNodes = e.currentTarget.checked;
	cy.json({ elements: generateElements() });
	renderBubbles();
})
document.querySelector('#allEdges').addEventListener('change', e => {
	allEdges = e.currentTarget.checked;
	renderRequestPath();
})
document.querySelector('#darkTheme').addEventListener('change', e => {
	darkTheme = e.currentTarget.checked;
	toggleTheme();
})
cy.on('tap', 'node', function () {
	const url = this.data('href')
	if (url) window.location.href = url
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
	// TODO - color things based on new style rules here
	//Object.entries(DIRECTORY_COLORS).forEach(([key, color]) => bb.addPath(cy.nodes(`.parent-${key}`), null, null, { ...options, style: { fill: color, fillOpacity: .25 } }))

	if (!currentRequest) return;
	const ids = new Set();
	for (const event of currentRequest.events) {
		const urls = generateEventURLs(event)
		const remaining = [...'added evaluated construct source error'.split` `.map(key => urls[key]).filter(Boolean).map(u => u.split('//').at(-1)).reverse(), ...(event.type === 'view' ? [viewsDirectory + '/' + event.name] : [])];

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

document.querySelectorAll('[id^="toggleButton"]').forEach(b => b.addEventListener('click', () => {
	const window = b.closest('.window');
	const body = JSON.parse(window.dataset.body)
	body.type = body.type === 'textContent' ? 'innerHTML' : 'textContent'
	window.dataset.body = JSON.stringify(body);
	const title = JSON.parse(window.dataset.title)
	title.type = title.type === 'textContent' ? 'innerHTML' : 'textContent'
	window.dataset.title = JSON.stringify(title);

	updateWindowHTML(window, body, title);
}));

function updateWindowHTML(window, body, title) {
	if (body !== undefined) {
		//		if (body.type === 'textContent' && !window.querySelector('pre')){
		//			window.querySelector('iframe').remove();
		//			window.querySelector('.mainWindow').appendChild(document.createElement('pre'));
		//		}
		//		else if (body.type === 'innerHTML' && !window.querySelector('iframe')){
		//			window.querySelector('pre').remove();
		//			window.querySelector('.mainWindow').appendChild(document.createElement('iframe'));
		//		}
		//if (body.type === 'textContent') window.querySelector('pre').textContent = body.string;
		const pre = window.querySelector('pre')
		if (body.type === 'code') pre.innerHTML = '<code>' + hljs.highlightAuto(body.string).value + '</code>';
		else pre.innerHTML = body.type === 'innerHTML' ? body.string : escapeHtml(body.string);
		//else window.querySelector('iframe').srcdoc = `<style>.red {color: red;background-color: rgb(85, 0, 0);} .green {color: rgb(0, 255, 0);background-color: rgb(0, 85, 0);}</style><body><pre>${body.string}</pre></body>`;
	}
	if (title !== undefined) window.querySelector('.windowTitle')[title.type] = title.string;
}

/**
 * @param {number} id
 * @param {Record<'content' | 'title', { type: 'textContent' | 'innerHTML' | 'code', string: 'string' } | string>} data
 */
function renderWindow(id, { title, body }) {
	if (typeof body === 'string') body = { type: 'innerHTML', string: body }
	if (typeof title === 'string') title = { type: 'innerHTML', string: title }
	const window = document.querySelector(`#window${id}`);
	window.dataset.body = JSON.stringify(body);
	window.dataset.title = JSON.stringify(title);
	updateWindowHTML(window, body, title)
}

function generateEventURLs(event) {
	return {
		added: event.handler && `vscode://file${event.handler.adds[0][0]}`,
		evaluated: event.evaluate?.lines && `vscode://file${event.evaluate.lines[0]}`,
		construct: event.handler?.construct && `vscode://file${event.handler.construct[0]}`,
		source: event.handler?.location ? `vscode://file${event.handler.location.path}:${event.handler.location.line}:${event.handler.location.column}` : event.source_line && `vscode://file${event.source_line}`,
		error: event.error?.lines.length ? `vscode://file${event.error?.lines[0]}` : undefined
	}
}

function generateEventCodeHTML(event) {
	const urls = generateEventURLs(event)

	const codes = Object.fromEntries(Object.entries({
		added: event.handler?.code?.adds,
		evaluated: event.evaluate?.code,
		construct: event.handler?.code?.construct,
		source: event.handler?.code?.location,
		error: event.error?.code
	}).filter(([_, code]) => code))

	let allLines = [];
	for (const [key, code] of Object.entries(codes)) {
		allLines.push({
			key,
			html: hljs.lineNumbersValue(hljs.highlightAuto(code.map(l => l.trim() ? l : '​').join('\n')).value, { startFrom: +urls[key].split(':').at(-2) - 1 })
		});
	}

	return allLines.map(({ key, html }) => `${key[0].toUpperCase() + key.slice(1)} <a href="${urls[key]}">${urls[key].replace('vscode://file' + root, '')}</a><br/><code>${html}</code>`).join('<br/>');
}

function generateEventNodes(event, forward) {
	const nodes = [];

	const urls = generateEventURLs(event)
	const remaining = [...(event.type === 'view' ? [viewsDirectory + '/' + event.name] : []), ...'added evaluated construct source error'.split` `.map(key => urls[key]).filter(Boolean).map(u => u.split('//').at(-1)).reverse()];
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

let currentRequest = Object.values(requests)[0]
let nthMiddleware = 0;
let forward = true;
let tip;
let lastNode;
async function renderMiddleware() {
	if (!currentRequest) return
	document.querySelector('#events').value = nthMiddleware;

	document.querySelector('#event-small').textContent = `${nthMiddleware + 1}/${currentRequest.events.length}`
	const event = currentRequest.events[nthMiddleware]

	if (event.diffs) {
		renderWindow(1, { title: 'Request', body: event.diffs.request.replace(/<R2_A>([\s\S]*?)<\/R2_A>/g, (_, string) => `<span class="red">${string}</span>`).replace(/<R2_B>([\s\S]*?)<\/R2_B>/g, (_, string) => `<span class="green">${string}</span>`) });

		renderWindow(2, { title: 'Response', body: event.diffs.response.replace(/<R2_A>([\s\S]*?)<\/R2_A>/g, (_, string) => `<span class="red">${string}</span>`).replace(/<R2_B>([\s\S]*?)<\/R2_B>/g, (_, string) => `<span class="green">${string}</span>`) });
	} else if (event.type === 'redirect') {
		renderWindow(1, { body: '' })
		renderWindow(2, { title: 'Redirected', body: event.path })
	} else if (event.type === 'view') {
		renderWindow(1, { body: '' })
		renderWindow(2, { title: event.name + ' view', body: { type: 'code', string: event.locals ? JSON.stringify(event.locals, undefined, '  ') : '{}' } });
	} else if (event.type === 'send') {
		renderWindow(1, { body: '' })
		renderWindow(2, { title: 'Response Body', body: { type: 'code', string: event.body } });
	} else if (event.type === 'json') {
		renderWindow(1, { body: '' })
		renderWindow(2, { title: 'Response JSON', body: event.body });
	}

	const urls = generateEventURLs(event)
	const remaining = [...(event.type === 'view' ? [viewsDirectory + '/' + event.name] : []), ...'added evaluated construct source error'.split` `.map(key => urls[key]).filter(Boolean).map(u => u.split('//').at(-1)).reverse()];
	if (!forward) remaining.reverse()

	const w5 = document.querySelector('#window5 pre')
	w5.innerHTML = generateEventCodeHTML(event);
	attachRenderListeners(w5)

	const currentInAll = document.querySelector(`details[data-event-id="${event.start + '' + event.order}"]`)
	if (currentInAll) {
		currentInAll.open = true;
		currentInAll.scrollIntoView({ behavior: 'smooth', block: 'center' });
		document.querySelectorAll('details.highlighted-event').forEach(e => e.classList.remove('highlighted-event'));
		currentInAll.classList.add('highlighted-event');
	}

	disableButtons()
	while (remaining.length) {
		const url = remaining.pop()
		const target = sourceLineToID(Object.values(cy.elements()).map(cye => {
			if (typeof cye?.data === 'function') return { data: cye.data() }
			else return { data: {} }
		}), url)

		let node = cy.filter(e => e.data('id') === target?.data.id)[0];
		if (node) lastNode = node;
		else node = lastNode;

		if (!node) return;

		/*const nextReq = currentRequest.events[nthMiddleware + (forward ? 1 : -1)]
		if (nextReq) {
			const nextNodes = generateEventNodes(currentRequest.events[nthMiddleware + (forward ? 1 : -1)], forward);
			const otherNodeIDs = nextNodes.map(n => n.data('id'))
			const edgeIDs = new Set(otherNodeIDs.flatMap(id => [`${node.data('id')}-${id}`, `${id}-${node.data('id')}`]))
			node.connectedEdges().filter(e => edgeIDs.has(e.data('id'))).addClass('next-edge')
		}*/

		let ref = node.popperRef(); // used only for positioning
		// A dummy element must be passed as tippy only accepts dom element(s) as the target
		// https://atomiks.github.io/tippyjs/v6/constructor/#target-types
		let dummyDomEle = document.querySelector('#tooltippy');

		if (!tip) tip = new tippy(dummyDomEle, { // tippy props:
			getReferenceClientRect: ref.getBoundingClientRect, // https://atomiks.github.io/tippyjs/v6/all-props/#getreferenceclientrect
			trigger: 'manual', // mandatory, we cause the tippy to show programmatically.
			allowHTML: true,
			interactive: true,
			hideOnClick: false,
			duration: [0, 0],
			zIndex: 50,

			// your own custom props
			// content prop can be used when the target is a single element https://atomiks.github.io/tippyjs/v6/constructor/#prop
			content: () => {
				let content = document.createElement('div');

				content.innerHTML = generateEventLabel(event);
				content.innerHTML += '<br/>' + Object.entries(urls).filter(([_, url]) => url && !url.includes('node_modules') && !url.includes('express-handler-tracker')).reduce((lines, [name, url]) => [...lines, `<a href="${url}">${name[0].toUpperCase() + name.slice(1)}</a>`], []).join('<br/>')

				return content;
			}
		})
		else {
			function percentileDiff(a, b, percent) {
				return (b - a) * percent + a
			}
			const from = tip.props.getReferenceClientRect()
			const to = ref.getBoundingClientRect()
			if (JSON.stringify(from) !== JSON.stringify(to)) {
				for (let i = 1; i <= 50; i++) {
					setTimeout(() => {
						tip.setProps({
							getReferenceClientRect: () => {
								const updated = {};
								for (const key in from) {
									updated[key] = percentileDiff(from[key], to[key], i / 50)
								}
								return updated;
							}
						})
					}, i * (animationDuration / 50))
				}
			}

			tip.setContent(() => {
				let content = document.createElement('div');

				content.innerHTML = generateEventLabel(event);
				content.innerHTML += '<br/>' + Object.entries(urls).filter(([_, url]) => url && !url.includes('node_modules') && !url.includes('express-handler-tracker')).reduce((lines, [name, url]) => [...lines, `<a href="${url}">${name[0].toUpperCase() + name.slice(1)}</a>`], []).join('<br/>')

				return content;
			})
			if (JSON.stringify(from) !== JSON.stringify(to)) await new Promise(r => setTimeout(r, animationDuration));
		}
		tip.show();
	}
	enableButtons()
}

const requestSelect = document.querySelector('#requests');

function renderRequestsSelect() {
	const selected = requestSelect.value;
	requestSelect.innerHTML = '';
	requestSelect.appendChild(Object.entries(requests).reduce((frag, [value, request], i) => {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = request.start.request.method + ' ' + request.start.request.url
		if (!i && !selected) option.selected = true;
		else if (selected == option.value) option.selected = true;

		frag.appendChild(option)
		return frag;
	}, document.createDocumentFragment()))
}
renderRequestsSelect()


function generateEventLabel(event) {
	let label = 'Unknown';
	if (event.type === 'middleware') label = event.handler.name ? `${event.handler.name}()` : '<anonymous>'
	else if (event.type === 'redirect') label = `Redirect to ${event.path}`
	else if (event.type === 'view') label = viewsDirectory + `/` + event.name
	else if (event.type === 'send') label = 'response.send()'
	else if (event.type === 'json') label = 'response.json()'
	label += ' - ' + (event.end - event.start) + 'ms'
	if (event.type === 'finish') label = `Finished in ${event.end - currentRequest.events[0].start} ms`
	return label
}

function changeMiddleware(nth) {
	let oldNth = nthMiddleware;
	nthMiddleware = nth;
	forward = nthMiddleware > oldNth;
	renderMiddleware();
}

document.querySelector('#events').addEventListener('change', e => {
	e.currentTarget.selectedOptions[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	changeMiddleware(+e.currentTarget.value)
})

function renderMiddlewaresSelect() {

	const eventsSelector = document.querySelector('#events')
	const selected = eventsSelector.value;
	eventsSelector.innerHTML = '';
	eventsSelector.appendChild(currentRequest.events.reduce((frag, e, i) => {
		const option = document.createElement('option')
		option.value = i;
		option.textContent = generateEventLabel(e);
		frag.appendChild(option)
		if (selected == option.value) option.selected = true;
		return frag
	}, document.createDocumentFragment()));
	eventsSelector.size = eventsSelector.children.length
}

function attachRenderListeners(parent) {
	document.querySelectorAll('details').forEach(d => d.querySelector('button').addEventListener('click', () =>
		changeMiddleware(currentRequest.events.findIndex(e => e.start + '' + e.order === d.dataset.eventId))
	))
}

function renderRequestPath() {
	cy.edges('.request-edge').removeClass('request-edge');

	for (const [i, event] of currentRequest.events.entries()) {
		const nextEvent = currentRequest.events[i + 1]
		if (!nextEvent) continue;
		const from = generateEventNodes(event, forward).map(node => node.data('id'));
		const to = generateEventNodes(nextEvent, forward).map(node => node.data('id'));
		for (const f of from) {
			const edgeIDs = new Set(to.map(id => `${f}-${id}`))
			cy.filter(e => edgeIDs.has(e.data('id'))).addClass('request-edge')
		}
	}

	if (allEdges) return cy.edges('.hidden').removeClass('hidden');
	cy.edges('*').not('.request-edge').addClass('hidden')
	cy.edges('.request-edge').removeClass('request-edge');
}
function renderRequest() {
	nthMiddleware = 0;
	renderMiddleware();
	renderBubbles()
	if (!currentRequest) return
	renderMiddlewaresSelect()

	const w6 = document.querySelector('#window6 pre')
	w6.innerHTML = '';
	for (const e of currentRequest.events) {
		w6.innerHTML += `<details open data-event-id="${e.start + '' + e.order}"><summary>${generateEventLabel(e)} <button>Render</button></summary>${generateEventCodeHTML(e)}</details>`
	}
	attachRenderListeners(w6)
	renderRequestPath()
}
requestSelect.addEventListener('change', (e) => {
	currentRequest = requests[e.currentTarget.value]
	renderRequest()
})

function enableButtons() {
	document.querySelectorAll('#events, #prev-middleware, #next-middleware').forEach(b => b.disabled = false)
}
function disableButtons() {
	document.querySelectorAll('#events, #prev-middleware, #next-middleware').forEach(b => b.disabled = true)
}

renderRequest()

const observer = new MutationObserver(mutations => {
	for (const { target: w } of mutations) {
		localStorage.setItem(`${w.id}-style`, w.getAttribute('style'));
	}
})
document.querySelectorAll('.window').forEach(w => observer.observe(w, { attributeFilter: ['class'] }))

/*
document.getElementById("save").addEventListener("click", function () {
	window.localStorage.setItem("cy-elements", JSON.stringify(cy.json()));
	alert('Graph Layout save to Local Storage')
});
*/

document.querySelector('#window1').setAttribute('style', window.localStorage.getItem("window1-style") || '');
document.querySelector('#window2').setAttribute('style', window.localStorage.getItem("window2-style") || '');
document.querySelector('#window3').setAttribute('style', window.localStorage.getItem("window3-style") || '');
document.querySelector('#window4').setAttribute('style', window.localStorage.getItem("window4-style") || '');
document.querySelector('#window5').setAttribute('style', window.localStorage.getItem("window5-style") || '');
document.querySelector('#window6').setAttribute('style', window.localStorage.getItem("window6-style") || '');
document.querySelector('#button1').className = +document.querySelector('#window1').style.opacity ? 'btn-success' : ''
document.querySelector('#button2').className = +document.querySelector('#window2').style.opacity ? 'btn-success' : ''
document.querySelector('#button3').className = +document.querySelector('#window3').style.opacity ? 'btn-success' : ''
document.querySelector('#button4').className = +document.querySelector('#window4').style.opacity ? 'btn-success' : ''
document.querySelector('#button5').className = +document.querySelector('#window5').style.opacity ? 'btn-success' : ''
document.querySelector('#button6').className = +document.querySelector('#window6').style.opacity ? 'btn-success' : ''

document.querySelector('#button1').addEventListener('click', () => setTimeout(() => localStorage.setItem(`window1-style`, document.querySelector('#window' + 1).getAttribute('style')), 1000));
document.querySelector('#button2').addEventListener('click', () => setTimeout(() => localStorage.setItem(`window2-style`, document.querySelector('#window' + 2).getAttribute('style')), 1000));
document.querySelector('#button3').addEventListener('click', () => setTimeout(() => localStorage.setItem(`window3-style`, document.querySelector('#window' + 3).getAttribute('style')), 1000));
document.querySelector('#button4').addEventListener('click', () => setTimeout(() => localStorage.setItem(`window4-style`, document.querySelector('#window' + 4).getAttribute('style')), 1000));
document.querySelector('#button5').addEventListener('click', () => setTimeout(() => localStorage.setItem(`window5-style`, document.querySelector('#window' + 5).getAttribute('style')), 1000));
document.querySelector('#button6').addEventListener('click', () => setTimeout(() => localStorage.setItem(`window6-style`, document.querySelector('#window' + 6).getAttribute('style')), 1000));

/*
document.getElementById("restore").addEventListener("click", function () {
	cy.elements().remove();
	cy.json({ elements: JSON.parse(window.localStorage.getItem("cy-elements")).elements }).layout({ name: 'preset' }).run();
	renderRequestsSelect()
	renderMiddleware()
	renderBubbles();
});
*/

document.querySelector('#reset-windows').addEventListener('click', () => {
	for (const child of document.querySelector('.windowGroup').children) {
		child.removeAttribute('style');
	}
	for (let i = 1; i <= 6; i++) {
		document.querySelector('#button' + i).className = '';
		setTimeout((i) => localStorage.setItem(`window${i}-style`, document.querySelector('#window' + i).getAttribute('style')), 1000, i);
	}
})

document.querySelector('#reset-all').addEventListener('click', () => {
	if (!confirm('Clearing all local settings, are you sure?')) return
	localStorage.clear()
	alert('All local settings cleared')
	window.location.reload()
})
/*
document.querySelector('#export').addEventListener('click', () => {
	const data = Flatted.stringify({
		requests,
		modules,
		root,
		viewsDirectory,
		windows: [
			document.querySelector('#window1').getAttribute('style'),
			document.querySelector('#window2').getAttribute('style'),
			document.querySelector('#window3').getAttribute('style'),
			document.querySelector('#window4').getAttribute('style'),
			document.querySelector('#window5').getAttribute('style'),
			document.querySelector('#window6').getAttribute('style'),
		],
		cyElements: cy.json()
	})
	navigator.clipboard.writeText(data).then(() => alert('All data saved to clipboard!'));
});

document.querySelector('#import').addEventListener('click', () => {
	(navigator.clipboard.readText?.() || (async () => {
		const checkbox = document.querySelector('#modal-1');
		checkbox.checked = true;
		return new Promise(async (resolve, reject) => {
			while (checkbox.checked) await new Promise(r => setTimeout(r, 1000));
			const text = document.querySelector('#import-text').value
			if (text) return resolve(text)
			const file = document.querySelector('#import-file').files[0]
			if (!file) return reject(new Error('No data given'));
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.readAsText(file);
		});
	})()).then(text => {
		const data = Flatted.parse(text);
		({ requests, modules, root, viewsDirectory } = data);
		cy.elements().remove();
		cy.json({ elements: data.cyElements.elements }).layout({ name: 'preset' }).run();
		renderRequestsSelect()
		renderMiddleware()
		renderBubbles();
		document.querySelector('#window1').setAttribute('style', data.windows[0]);
		document.querySelector('#window2').setAttribute('style', data.windows[1]);
		document.querySelector('#window3').setAttribute('style', data.windows[2]);
		document.querySelector('#window4').setAttribute('style', data.windows[3]);
		document.querySelector('#window5').setAttribute('style', data.windows[3]);
		document.querySelector('#window6').setAttribute('style', data.windows[3]);
	});
});
*/
document.querySelectorAll('.window').forEach(w => w.addEventListener('click', e => activeWindow(e.currentTarget)));