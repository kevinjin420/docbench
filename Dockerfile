FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    jaclang>=0.9.13 \
    openai \
    authlib \
    pyjwt \
    requests \
    matplotlib \
    numpy

COPY . .

EXPOSE 8000

CMD ["jac", "start", "main.jac"]
