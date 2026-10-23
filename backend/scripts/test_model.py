#!/usr/bin/env python3
"""
Test any Bedrock model with a simple prompt
Usage: python3 test_model.py <model-id> [prompt]
"""
import boto3
import json
import os
import sys

def test_bedrock_model(model_id, prompt="Hello! Please introduce yourself in one sentence."):
    # Use boto3's default credential chain (environment, profile, or IAM role).
    region = os.getenv('AWS_REGION', 'ap-south-1')

    # Create Bedrock Runtime client
    bedrock_runtime = boto3.client(
        'bedrock-runtime',
        region_name=region
    )

    print(f"\n🤖 Testing Model: {model_id}")
    print(f"📝 Prompt: {prompt}\n")
    print("=" * 70)

    try:
        # Build request body based on model provider
        if "anthropic.claude" in model_id:
            # Anthropic Claude format
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        elif "openai.gpt" in model_id:
            # OpenAI format
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_completion_tokens": 512
            })
        elif "meta.llama" in model_id:
            # Meta Llama format (legacy prompt format)
            body = json.dumps({
                "prompt": prompt,
                "max_gen_len": 512,
                "temperature": 0.7,
                "top_p": 0.9
            })
        elif "mistral." in model_id:
            # Mistral format
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 512,
                "temperature": 0.7
            })
        elif "amazon.nova" in model_id:
            # Amazon Nova format
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": [{"text": prompt}]}
                ],
                "inferenceConfig": {
                    "max_new_tokens": 512,
                    "temperature": 0.7
                }
            })
        elif "deepseek" in model_id:
            # DeepSeek format
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 512,
                "temperature": 0.7
            })
        elif "xai.grok" in model_id:
            # xAI Grok format
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 512,
                "temperature": 0.7
            })
        else:
            # Generic format (works for most models)
            body = json.dumps({
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 512,
                "temperature": 0.7
            })

        # Invoke model
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=body,
            contentType="application/json",
            accept="application/json"
        )

        # Parse response
        response_body = json.loads(response['body'].read())

        # Extract text based on response format
        if 'content' in response_body and isinstance(response_body['content'], list):
            # Anthropic format
            text = response_body['content'][0]['text']
        elif 'generation' in response_body:
            # Meta Llama format
            text = response_body['generation']
        elif 'choices' in response_body:
            # OpenAI/Mistral format
            if 'message' in response_body['choices'][0]:
                text = response_body['choices'][0]['message']['content']
            elif 'text' in response_body['choices'][0]:
                text = response_body['choices'][0]['text']
            else:
                text = str(response_body['choices'][0])
        elif 'outputs' in response_body:
            # AI21 format
            text = response_body['outputs'][0]['text']
        elif 'output' in response_body:
            # Amazon Nova format
            text = response_body['output']['message']['content'][0]['text']
        else:
            # Fallback: show entire response
            text = json.dumps(response_body, indent=2)

        print(f"\n✅ Response:\n{text}\n")
        print("=" * 70)

        # Show token usage if available
        if 'usage' in response_body:
            print(f"\n📊 Token Usage: {response_body['usage']}\n")

        return True

    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        print("Troubleshooting:")
        print("1. Check if model ID is correct")
        print("2. Verify model access is enabled in your AWS account")
        print("3. Some models may require different request formats\n")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 test_model.py <model-id> [prompt]")
        print("\nExamples:")
        print("  python3 test_model.py anthropic.claude-sonnet-5-5")
        print("  python3 test_model.py meta.llama3-3-70b-instruct-v1:0 'Write a haiku'")
        print("  python3 test_model.py openai.gpt-6-sol 'Explain quantum computing'")
        sys.exit(1)

    model_id = sys.argv[1]
    prompt = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "Hello! Please introduce yourself in one sentence."

    test_bedrock_model(model_id, prompt)
