import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'

const app = new Hono()
app.use(renderer)
app.use('/api/*', cors())






app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
});

app.notFound(c => c.text('Not found', 404));

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1><p>This is a placeholder.</p>)
})

export default app
