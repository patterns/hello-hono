import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'

type Bindings = {
      DB: D1Database
}

const app = new Hono<{Bindings: Bindings}>()
app.use(renderer)
app.use('/api/*', cors())

app.get('/api/posts/:slug/comments', async c => {



});

app.post('/api/posts/:slug/comments', async c => {


});

app.onError((err, c) => {
	console.error(`${err}`);
	return c.text(err.toString());
});

app.notFound(c => c.text('Not found', 404));

app.get('/', (c) => {
  return c.render(<p>Hello! This is a placeholder.</p>)
})

export default app
