import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from './config/swagger';
import urlRoutes from './routes/url.routes';
import { registerUrlRoutes } from './config/swagger.registry';

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

//Register swagger routes
registerUrlRoutes();

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(generateOpenAPIDocument()));

// Routes
app.use('/api', urlRoutes);

export default app;