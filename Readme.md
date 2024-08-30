# Servicio de Chat Seguro con Anonimización

Este proyecto implementa un servicio de chat seguro que anonimiza la información personal antes de procesarla con ChatGPT y luego desanonimiza la respuesta. Utiliza MongoDB para almacenar los tokens de anonimización y la API de OpenAI para generar respuestas.

## Características

- Anonimización de información personal (nombres, correos electrónicos, números de teléfono)
- Integración con ChatGPT de OpenAI
- Almacenamiento seguro de tokens en MongoDB
- Manejo de errores de cuota de API

## Requisitos previos

- Node.js (versión 14 o superior)
- MongoDB
- Cuenta de OpenAI con clave de API

## Instalación

1. Clona el repositorio:
   ```
   git clone https://github.com/tu-usuario/tu-repositorio.git
   cd tu-repositorio
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto con la siguiente información:
   ```
   MONGODB_URI=tu_uri_de_mongodb
   OPENAI_API_KEY=tu_clave_de_api_de_openai
   PORT=3001
   ```
   
   **Importante**: Debes reemplazar `tu_clave_de_api_de_openai` con tu propia clave de API de OpenAI. Puedes obtener una clave en [https://platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).

4. Inicia el servidor:
   ```
   node server.js
   ```

## Uso

El servicio expone los siguientes endpoints:

- `/anonymize`: Anonimiza un mensaje
- `/deanonymize`: Desanonimiza un mensaje
- `/secureChatGPT`: Procesa un prompt de forma segura con ChatGPT

Ejemplos de uso con curl para el endpoint `/secureChatGPT`:

1. Información personal básica:
```
curl --location 'http://localhost:3001/secureChatGPT' \
--header 'Content-Type: application/json' \
--data-raw '{
    "prompt": "Hola, me llamo Juan Pérez y mi correo es juan.perez@gmail.com. Mi número de teléfono es +57 300 123 4567"
}'
```

2. Solicitud de resumen profesional:
```

    "prompt": "Mi nombre es Ana Rodríguez, soy ingeniera de software con 5 años de experiencia. Mi email es ana.rodriguez@techcompany.com y mi número de contacto es +34 612 345 678. ¿Puedes crear un breve resumen profesional para mí?"
```
